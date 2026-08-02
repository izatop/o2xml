# o2xml Package Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a documented, audited, fully tested dual CJS/ESM `o2xml` package
with Bun tooling and npm Trusted Publishing.

**Architecture:** Bun manages the dependency graph, runs source tests, and
bundles one Node.js entrypoint per module format. TypeScript checks strict CJS
and ESM source semantics and emits declarations. A packed consumer validates
runtime exports, types, and the zero-runtime-dependency contract.

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, `bun:test`, oxlint 1.76.0, oxfmt
0.61.0, Node.js 24, GitHub Actions, npm OIDC.

## Global Constraints

- Preserve `transform`, `TransformObject`, `AnyObject`, `TransformFormatter`,
  and `TransformOptions` exports.
- Preserve current XML output and current input-mutation behavior.
- Keep the package free of production dependencies.
- Keep `@types/node` in `devDependencies`; do not add `@types/sax`.
- Build `dist/index.mjs` and `dist/index.cjs` with Bun and linked source maps.
- Emit declarations into `dist/types` with TypeScript.
- Require 100% lines, functions, and statements under `src/**`.
- Run `bun audit` without filters or ignored advisories.
- Keep GitHub Action references pinned to full commit hashes.
- Do not change package version, create a tag, or publish to npm.

---

### Task 1: Replace Yarn and Mocha with the Bun Development Baseline

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`
- Create: `bun.lock`
- Create: `bunfig.toml`
- Create: `.editorconfig`
- Create: `.oxlintrc.json`
- Create: `.oxfmtrc.json`
- Create: `test/index.test.ts`
- Create: `test/tsconfig.json`
- Delete: `.yarn/**`
- Delete: `.yarnrc.yml`
- Delete: `yarn.lock`
- Delete: `test/index.ts`

**Interfaces:**

- Consumes: `transform(object: AnyObject, options?: TransformOptions): string`.
- Produces: Bun scripts, Bun tests for preserved behavior, and a dependency
  graph with no production packages.

- [ ] **Step 1: Port representative behavior to `bun:test`**

Create `test/index.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { transform } from "../src";

describe("transform", () => {
    test("serializes nested values and attributes", () => {
        const input = {
            root: {
                "@enabled": true,
                item: [{ "#text": "one" }, { "#text": "two" }],
            },
        };
        expect(transform(input)).toBe('<root enabled="1"><item>one</item><item>two</item></root>');
        expect(input.root).not.toHaveProperty("@enabled");
    });

    test("serializes buffers", () => {
        expect(transform({ root: Buffer.from("data") })).toBe("<root>ZGF0YQ==</root>");
    });
});
```

The mutation assertion locks the current behavior before source modernization.

- [ ] **Step 2: Run Bun tests and capture RED**

Run:

```bash
bun test
```

Expected: FAIL before dependency migration because Bun cannot load the Yarn
lockfile and the new test types are unavailable.

- [ ] **Step 3: Replace package metadata and scripts**

Remove `dependencies` or keep it absent. Set:

```json
"devDependencies": {
    "@types/bun": "^1.3.14",
    "@types/node": "^26.1.2",
    "oxfmt": "^0.61.0",
    "oxlint": "^1.76.0",
    "rimraf": "^6.1.3",
    "typescript": "7.0.2"
},
"packageManager": "bun@1.3.14"
```

Remove Mocha, ts-node, and their types. Add:

```json
"test": "bun test",
"test:watch": "bun test --watch",
"test:typecheck": "tsc -p test/tsconfig.json",
"lint": "oxlint .",
"lint:fix": "oxlint --fix .",
"fmt": "oxfmt .",
"fmt:check": "oxfmt --check .",
"security": "bun audit"
```

- [ ] **Step 4: Add Bun and repository tool configuration**

Create `bunfig.toml`:

```toml
[install]
minimumReleaseAge = 259200
```

Create `test/tsconfig.json`:

```json
{
    "extends": "../tsconfig.json",
    "compilerOptions": {
        "noEmit": true,
        "rootDir": "..",
        "types": ["bun", "node"]
    },
    "include": ["../src", "."]
}
```

Copy the `gelf-client` correctness-only oxlint configuration, empty oxfmt
ignore list, and four-space LF `.editorconfig`. Oxfmt will normalize tracked
TypeScript and Markdown line endings in later tasks.

- [ ] **Step 5: Remove Yarn artifacts and install with Bun**

Run:

```bash
git rm -r .yarn .yarnrc.yml yarn.lock test/index.ts
bun install
```

Update `.gitignore` to remove Yarn cache rules and keep `node_modules/`,
`dist/`, `*.tsbuildinfo`, `.DS_Store`, and `.local/` ignored.

- [ ] **Step 6: Run the migrated baseline**

Run:

```bash
bun test
bun run test:typecheck
bun run security
```

Expected: preservation tests pass, test types resolve, and Bun reports no known
advisory. Record the dependency path before fixing any reported advisory.

- [ ] **Step 7: Commit the Bun baseline**

```bash
git add package.json bun.lock bunfig.toml .editorconfig .oxlintrc.json .oxfmtrc.json .gitignore test
git commit -m "build: migrate development tooling to Bun"
```

### Task 2: Make the Source Strict under TypeScript 7

**Files:**

- Modify: `tsconfig.json`
- Create: `tsconfig.esnext.json`
- Create: `tsconfig.cjs.json`
- Modify: `src/index.ts`

**Interfaces:**

- Consumes: the preserved transformer tests from Task 1.
- Produces: strict TypeScript 7 source that keeps the same runtime and declared
  exports.

- [ ] **Step 1: Split shared and module-specific compiler settings**

Set `tsconfig.json`:

```json
{
    "compilerOptions": {
        "target": "esnext",
        "rootDir": "src",
        "declaration": true,
        "sourceMap": true,
        "types": ["node"],
        "strict": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "incremental": true,
        "noEmit": true
    },
    "exclude": ["node_modules", "test"],
    "include": ["src"]
}
```

Create `tsconfig.esnext.json`:

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "module": "esnext",
        "moduleResolution": "bundler",
        "outDir": "dist/types",
        "tsBuildInfoFile": "tsconfig.esnext.tsbuildinfo"
    }
}
```

Create `tsconfig.cjs.json`:

```json
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "module": "commonjs",
        "outDir": "dist/cjs-types",
        "tsBuildInfoFile": "tsconfig.cjs.tsbuildinfo"
    }
}
```

- [ ] **Step 2: Run TypeScript 7 and capture RED**

Run:

```bash
bunx tsc -p tsconfig.esnext.json
bunx tsc -p tsconfig.cjs.json
```

Expected: FAIL on implicit `any`, optional formatter access, optional level and
indent values, untyped attribute maps, or legacy angle-bracket assertions.

- [ ] **Step 3: Introduce explicit public and internal types**

Replace the ambient Buffer declaration with:

```typescript
import { Buffer } from "node:buffer";
```

Export interfaces at their declarations. Define formatter options and a
normalized internal option type:

```typescript
interface TransformFormatters {
    string?: TransformFormatter<string>;
    number?: TransformFormatter<number>;
    date?: TransformFormatter<Date>;
    boolean?: TransformFormatter<boolean>;
}

type NormalizedOptions = {
    pretty: boolean;
    indent: string;
    declaration: boolean;
    formatters: Required<Omit<TransformFormatters, "date">> & Pick<TransformFormatters, "date">;
};
```

Cast the existing options object to `NormalizedOptions` and fill its missing
defaults in place so caller-visible option mutation stays unchanged. Type
`escapeStringCodes` as `Record<string, string>`, attribute maps as
`Record<string, unknown>`, and attribute output as
`Array<{ key: string; value: string }>`. Replace `<any>` assertions with `as`
syntax. Give recursive level parameters concrete defaults.

- [ ] **Step 4: Preserve export and mutation behavior**

Keep the final runtime export list equivalent to:

```typescript
export { TransformObject, transform };
```

Export `AnyObject`, `TransformFormatter`, and `TransformOptions` as types. Keep
the existing deletion of `@` keys from plain input objects. Do not clone the
input in this migration.

- [ ] **Step 5: Verify strict types and behavior**

Run:

```bash
bunx tsc -p tsconfig.esnext.json
bunx tsc -p tsconfig.cjs.json
bun run test:typecheck
bun test
```

Expected: both module targets and all preserved behavior pass.

- [ ] **Step 6: Commit TypeScript 7 compatibility**

```bash
git add src/index.ts tsconfig.json tsconfig.esnext.json tsconfig.cjs.json test
git commit -m "refactor: type-check transformer with TypeScript 7"
```

### Task 3: Reach and Enforce Full Production Coverage

**Files:**

- Modify: `bunfig.toml`
- Modify: `test/index.test.ts`

**Interfaces:**

- Consumes: `transform` options, values, validation, formatter, and error paths.
- Produces: coverage value `1.0` for lines, functions, and statements.

- [ ] **Step 1: Enable the coverage gate**

Append:

```toml
[test]
coverage = true
coverageSkipTestFiles = true
coveragePathIgnorePatterns = ["test/**"]
coverageThreshold = { lines = 1.0, functions = 1.0, statements = 1.0 }
```

- [ ] **Step 2: Run coverage and capture RED**

Run:

```bash
bun test --coverage --coverage-reporter=text
```

Expected: FAIL below 100%. Record each uncovered line before adding a test.

- [ ] **Step 3: Port the complete legacy suite**

Add the existing root count, root array, empty element, list, declaration, name
validation, namespace prefix, date, boolean, buffer, mixed text, deep object,
attribute null, invalid attribute name, and invalid attribute value cases with
Bun assertions.

Use `expect(() => transform(input)).toThrow(...)` for errors and exact string
comparisons for output.

- [ ] **Step 4: Cover formatter, pretty-print, scalar, and error branches**

Add cases shaped like:

```typescript
expect(
    transform(
        { root: { "@date": new Date("2020-01-01T00:00:00.000Z"), value: 2 } },
        {
            pretty: true,
            indent: "\t",
            declaration: true,
            formatters: {
                date: () => "DATE",
                number: (value) => `n:${value}`,
                boolean: (value) => String(value),
                string: (value) => value.toUpperCase(),
            },
        },
    ),
).toContain('date="DATE"');

expect(() => transform({ root: /unsupported/ })).toThrow(TypeError);
expect(() => transform({ root: { "@bad": /unsupported/ } })).toThrow();
expect(transform({ root: undefined })).toContain("<!-- undefined -->");
```

Cover escaped quotes, apostrophes, ampersands, angle brackets, false booleans,
zero, empty strings, null children, arrays, Date values, Buffer attributes, and
plain objects with a null prototype.

- [ ] **Step 5: Run full coverage and static checks**

Run:

```bash
bun test --coverage --coverage-reporter=text
bun run test:typecheck
bun run lint
```

Expected: 100% lines, functions, and statements with no lint error.

- [ ] **Step 6: Commit the coverage gate**

```bash
git add bunfig.toml test/index.test.ts
git commit -m "test: enforce full source coverage"
```

### Task 4: Build and Verify the Dual Package

**Files:**

- Modify: `package.json`
- Create: `test/package-consumer.ts`

**Interfaces:**

- Consumes: runtime exports `transform` and `TransformObject`, plus public
  declaration-only types.
- Produces: CJS, ESM, types, maps, and a verified zero-dependency tarball.

- [ ] **Step 1: Create a consumer that demands the package contract**

Create `test/package-consumer.ts`. Pack and unpack the repository in a temporary
directory, then assert:

```typescript
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
```

Assert both JavaScript files, both source maps, and declarations exist. Write
an ESM consumer that imports `{ transform, TransformObject }`, a CommonJS
consumer that reads those properties from `require("o2xml")`, and a TypeScript
consumer that imports `TransformOptions`. Execute both Node consumers and
type-check the TypeScript consumer. Remove temporary files in `finally`.

- [ ] **Step 2: Run the packed consumer and capture RED**

Run:

```bash
bun test/package-consumer.ts
```

Expected: FAIL because the current package has no exports map or dual artifacts.

- [ ] **Step 3: Add dual entry metadata and build scripts**

Set:

```json
"main": "./dist/index.cjs",
"module": "./dist/index.mjs",
"types": "./dist/types/index.d.ts",
"typings": "./dist/types/index.d.ts",
"exports": {
    ".": {
        "types": "./dist/types/index.d.ts",
        "import": "./dist/index.mjs",
        "require": "./dist/index.cjs",
        "default": "./dist/index.mjs"
    }
}
```

Add these scripts:

```json
"clean": "rimraf dist tsconfig.tsbuildinfo tsconfig.esnext.tsbuildinfo tsconfig.cjs.tsbuildinfo",
"typecheck:source": "tsc -p tsconfig.esnext.json && tsc -p tsconfig.cjs.json",
"build:types": "tsc -p tsconfig.esnext.json --noEmit false --emitDeclarationOnly",
"build:esm": "bun build src/index.ts --target=node --format=esm --packages=external --sourcemap=linked --minify-syntax --outdir=dist --entry-naming=index.mjs",
"build:cjs": "bun build src/index.ts --target=node --format=cjs --packages=external --sourcemap=linked --minify-syntax --outdir=dist --entry-naming=index.cjs",
"build": "bun run clean && bun run typecheck:source && bun run build:types && bun run build:esm && bun run build:cjs",
"test:package": "bun test/package-consumer.ts",
"check": "bun run fmt:check && bun run lint && bun run test:typecheck && bun run test && bun run build && bun run test:package"
```

- [ ] **Step 4: Run packed verification**

Run:

```bash
bun run build
bun run test:package
bun pm pack --dry-run
```

Expected: artifacts, export maps, both runtime consumers, TypeScript consumer,
zero runtime dependencies, and the file list pass.

- [ ] **Step 5: Commit the package build**

```bash
git add package.json test/package-consumer.ts
git commit -m "build: publish dual Bun bundles"
```

### Task 5: Correct and Expand the README

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: verified transformer types, options, errors, CJS, and ESM exports.
- Produces: examples covered by source tests and packed consumers.

- [ ] **Step 1: Add all installation forms**

Document:

```bash
npm install o2xml
bun add o2xml
yarn add o2xml
```

- [ ] **Step 2: Add verified ESM and CommonJS usage**

Use:

```typescript
import { transform } from "o2xml";
const xml = transform({ root: { "@id": 1, "#text": "value" } });
```

```javascript
const { transform } = require("o2xml");
const xml = transform({ root: { "@id": 1, "#text": "value" } });
```

Keep the object-to-XML example output exact and covered by a unit test.

- [ ] **Step 3: Check options, values, errors, and behavior**

Document `pretty`, `indent`, `declaration`, formatter callbacks, escaping,
attributes, text fragments, arrays, dates, buffers, supported root shape, and
thrown validation errors. State that transformation consumes `@` properties
from plain object nodes because tests preserve that current behavior.

- [ ] **Step 4: Add development commands and verify prose**

Document `bun install`, `bun run security`, `bun test`, `bun run build`, and
`bun run check`. Then run:

```bash
bun run test:package
bun run fmt:check
git diff --check
```

Expected: README module forms match the packed package and formatting passes.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: document installation and module usage"
```

### Task 6: Add CI, Strict Audit, and Trusted Publishing

**Files:**

- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/publish.yml`

**Interfaces:**

- Consumes: `bun ci`, `bun run security`, and `bun run check`.
- Produces: branch CI and tag publishing through npm OIDC.

- [ ] **Step 1: Add branch CI**

Create a push and pull-request workflow with `contents: read`, ref-scoped
concurrency, and these pinned actions:

```yaml
actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
```

Run `bun ci`, `bun run security`, and `bun run check` in separate steps.

- [ ] **Step 2: Replace token publishing with npm OIDC**

Keep the `v*` trigger and add `workflow_dispatch.inputs.tag`. Grant
`contents: read` and `id-token: write`. Check out the exact tag, install through
Bun, audit, run checks, and configure:

```yaml
actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
```

with Node 24 and the npm registry. Run `npm publish --provenance`. Remove
`fregante/setup-git-user`, `NODE_AUTH_TOKEN`, and `NPM_TOKEN`.

- [ ] **Step 3: Validate workflow content**

Run:

```bash
rg -n 'NPM_TOKEN|NODE_AUTH_TOKEN|setup-git-user|uses: .*@(v|main|master)' .github
rg -n 'id-token: write|npm publish --provenance|bun run security|bun run check' .github
git diff --check
```

Expected: no unpinned action or registry token remains; required audit, check,
OIDC, and provenance lines exist.

- [ ] **Step 4: Commit workflows**

```bash
git add .github/workflows
git commit -m "ci: verify and publish with Bun"
```

### Task 7: Run Final Package and Security Gates

**Files:**

- Modify only files required by a concrete failing gate.

**Interfaces:**

- Consumes: all prior tasks.
- Produces: current dependency, audit, test, build, tarball, documentation, and
  worktree evidence.

- [ ] **Step 1: Check dependency freshness**

Run:

```bash
bun outdated
```

Expected: no direct dependency has a newer compatible or latest version.
Explain any version held back by `minimumReleaseAge`.

- [ ] **Step 2: Run strict audit and aggregate verification**

Run:

```bash
bun run security
bun run check
bun pm pack --dry-run
```

Expected: no advisory; formatting, linting, typechecks, 100% coverage, build,
consumer checks, and tarball inspection pass.

- [ ] **Step 3: Inspect dependency and repository state**

Run:

```bash
git diff origin/main...HEAD -- package.json bun.lock
git diff origin/main...HEAD --stat
git diff --check
git status --short --branch
```

Expected: `dependencies` is absent, `@types/node` is dev-only, `@types/sax` is
absent, no Yarn artifact remains, and the worktree is clean after all commits.

- [ ] **Step 4: Route any failure back to its owning task**

Do not create a generic cleanup commit. A dependency, source, test, build,
README, or workflow failure reopens Task 1, 2, 3, 4, 5, or 6 respectively and
uses that task's focused files, verification command, and commit message.
