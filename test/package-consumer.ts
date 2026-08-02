import {
    access,
    lstat,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rename,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const repositoryDirectory = process.cwd();
const temporaryDirectory = await mkdtemp(join(tmpdir(), "o2xml-package-"));

const run = async (command: string[], cwd: string): Promise<void> => {
    const child = Bun.spawn(command, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
    ]);

    if (exitCode !== 0) {
        throw new Error(
            `${command.join(" ")} failed with exit code ${exitCode}\n${stdout}${stderr}`,
        );
    }
};

const listFiles = async (
    directory: string,
    rootDirectory: string = directory,
): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = join(directory, entry.name);
            if (entry.isDirectory()) {
                return listFiles(entryPath, rootDirectory);
            }

            return [relative(rootDirectory, entryPath)];
        }),
    );

    return files.flat();
};

try {
    await run(["bun", "pm", "pack", "--destination", temporaryDirectory], repositoryDirectory);
    const archiveName = (await readdir(temporaryDirectory)).find((file) => file.endsWith(".tgz"));
    if (archiveName === undefined) {
        throw new Error("bun pm pack did not create a tarball");
    }
    await run(
        ["tar", "-xzf", join(temporaryDirectory, archiveName), "-C", temporaryDirectory],
        repositoryDirectory,
    );

    const packedDirectory = join(temporaryDirectory, "package");
    const packedPackageJson = JSON.parse(
        await readFile(join(packedDirectory, "package.json"), "utf8"),
    ) as {
        dependencies?: unknown;
        devDependencies?: Record<string, unknown>;
        exports?: { "."?: { types?: string; import?: string; require?: string } };
    };
    const rootExport = packedPackageJson.exports?.["."];
    if (
        rootExport?.types !== "./dist/types/index.d.ts" ||
        rootExport?.import !== "./dist/index.mjs" ||
        rootExport?.require !== "./dist/index.cjs"
    ) {
        throw new Error("The packed package does not expose the dual entrypoints");
    }
    if (packedPackageJson.dependencies !== undefined) {
        throw new Error("o2xml must not publish runtime dependencies");
    }
    if (
        packedPackageJson.devDependencies?.["@types/node"] === undefined ||
        packedPackageJson.devDependencies?.["@types/sax"] !== undefined
    ) {
        throw new Error("The packed manifest has the wrong type dependencies");
    }

    const packedFiles = (await listFiles(packedDirectory)).sort();
    const expectedPackedFiles = [
        "LICENSE",
        "README.md",
        "dist/index.cjs",
        "dist/index.cjs.map",
        "dist/index.mjs",
        "dist/index.mjs.map",
        "dist/types/index.d.ts",
        "package.json",
    ];
    if (JSON.stringify(packedFiles) !== JSON.stringify(expectedPackedFiles)) {
        throw new Error(`Unexpected packed files: ${packedFiles.join(", ")}`);
    }

    const consumerDirectory = join(temporaryDirectory, "consumer");
    const packageDirectory = join(consumerDirectory, "node_modules", "o2xml");
    await mkdir(join(consumerDirectory, "node_modules"), { recursive: true });
    await rename(packedDirectory, packageDirectory);
    const installedPackages = await readdir(join(consumerDirectory, "node_modules"));
    if (JSON.stringify(installedPackages) !== JSON.stringify(["o2xml"])) {
        throw new Error("The package consumer must not receive repository dependencies or @types");
    }
    if ((await lstat(packageDirectory)).isSymbolicLink()) {
        throw new Error("The packed consumer must use extracted package files, not a symlink");
    }
    await access(join(packageDirectory, "dist", "index.mjs"));
    await access(join(packageDirectory, "dist", "index.mjs.map"));
    await access(join(packageDirectory, "dist", "index.cjs"));
    await access(join(packageDirectory, "dist", "index.cjs.map"));
    await access(join(packageDirectory, "dist", "types", "index.d.ts"));

    await writeFile(
        join(consumerDirectory, "consumer.mjs"),
        `
import { TransformObject, transform } from "o2xml";

if (transform({ root: "value" }) !== "<root>value</root>") throw new Error("Unexpected ESM transform output");
if (typeof TransformObject !== "function") throw new Error("TransformObject is not an ESM runtime export");
`,
    );
    await writeFile(
        join(consumerDirectory, "consumer.cjs"),
        `
void (async () => {
    const { TransformObject, transform } = require("o2xml");
    if (transform({ root: "value" }) !== "<root>value</root>") throw new Error("Unexpected CommonJS transform output");
    if (typeof TransformObject !== "function") throw new Error("TransformObject is not a CommonJS runtime export");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
`,
    );
    await writeFile(
        join(consumerDirectory, "consumer-types.ts"),
        `
import { TransformObject, transform } from "o2xml";
import type { AnyObject, TransformFormatter, TransformOptions } from "o2xml";

const value: AnyObject = { root: { child: "value" } };
const formatter: TransformFormatter<string> = input => input.toUpperCase();
const options: TransformOptions = { pretty: true };
const transformed: TransformObject = new TransformObject("root", { foo: "value" }, options);

value.root.child;
transformed.children.foo;
transform(value, { formatters: { string: formatter } });
`,
    );
    await writeFile(
        join(consumerDirectory, "tsconfig.json"),
        JSON.stringify(
            {
                compilerOptions: {
                    module: "NodeNext",
                    moduleResolution: "NodeNext",
                    noEmit: true,
                    strict: true,
                    target: "ES2022",
                    types: [],
                },
                include: ["consumer-types.ts"],
            },
            null,
            2,
        ),
    );

    await run(["node", "consumer.mjs"], consumerDirectory);
    await run(["node", "consumer.cjs"], consumerDirectory);
    await run(
        [join(repositoryDirectory, "node_modules", ".bin", "tsc"), "--project", "tsconfig.json"],
        consumerDirectory,
    );
} finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
}
