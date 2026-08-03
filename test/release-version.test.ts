import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { incrementPatch, resolveRelease } from "../scripts/release-version";

const script = fileURLToPath(new URL("../scripts/release-version.ts", import.meta.url));

describe("incrementPatch", () => {
    test("increments only the patch component", () => {
        expect(incrementPatch("0.3.2")).toBe("0.3.3");
        expect(incrementPatch("12.34.56")).toBe("12.34.57");
    });

    test("does not lose precision for a large patch component", () => {
        expect(incrementPatch("1.2.9007199254740992")).toBe("1.2.9007199254740993");
    });

    test("rejects non-stable versions", () => {
        for (const version of ["1.2", "1.2.3-beta.1", "01.2.3", "v1.2.3"]) {
            expect(() => incrementPatch(version)).toThrow(`Invalid npm version: ${version}`);
        }
    });
});

describe("resolveRelease", () => {
    test("prepares the next patch when repository and npm match", () => {
        expect(
            resolveRelease({
                packageVersion: "0.3.2",
                registryVersion: "0.3.2",
                taggedVersion: null,
            }),
        ).toEqual({ mode: "prepare", version: "0.3.3", tag: "v0.3.3" });
    });

    test("retries an existing pending patch", () => {
        expect(
            resolveRelease({
                packageVersion: "0.3.3",
                registryVersion: "0.3.2",
                taggedVersion: "0.3.3",
            }),
        ).toEqual({ mode: "retry", version: "0.3.3", tag: "v0.3.3" });
    });

    test("rejects a conflicting tag for a new patch", () => {
        expect(() =>
            resolveRelease({
                packageVersion: "0.3.2",
                registryVersion: "0.3.2",
                taggedVersion: "0.3.3",
            }),
        ).toThrow("Cannot prepare v0.3.3: tag already exists with package version 0.3.3");
    });

    test("rejects a retry with no tag", () => {
        expect(() =>
            resolveRelease({
                packageVersion: "0.3.3",
                registryVersion: "0.3.2",
                taggedVersion: null,
            }),
        ).toThrow("Cannot retry v0.3.3: tag is missing");
    });

    test("rejects a retry whose tag contains another version", () => {
        expect(() =>
            resolveRelease({
                packageVersion: "0.3.3",
                registryVersion: "0.3.2",
                taggedVersion: "0.3.99",
            }),
        ).toThrow("Cannot retry v0.3.3: tagged package version is 0.3.99");
    });

    test("rejects repository and registry divergence", () => {
        expect(() =>
            resolveRelease({
                packageVersion: "0.4.0",
                registryVersion: "0.3.2",
                taggedVersion: null,
            }),
        ).toThrow("Version divergence: package.json=0.4.0, npm=0.3.2, pending patch=0.3.3");
    });

    test("rejects a malformed package version", () => {
        expect(() =>
            resolveRelease({
                packageVersion: "0.3.3-beta.1",
                registryVersion: "0.3.2",
                taggedVersion: null,
            }),
        ).toThrow("Invalid package.json version: 0.3.3-beta.1");
    });
});

describe("release-version CLI", () => {
    test("prints a GitHub output-compatible prepare decision", () => {
        const result = Bun.spawnSync(["bun", script, "resolve", "0.3.2", "0.3.2", "-"]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.toString()).toBe("mode=prepare\nversion=0.3.3\ntag=v0.3.3\n");
    });

    test("returns a non-zero status for an invalid decision", () => {
        const result = Bun.spawnSync(["bun", script, "resolve", "0.4.0", "0.3.2", "-"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr.toString()).toContain("Version divergence");
    });
});
