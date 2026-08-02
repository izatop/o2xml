# o2xml Package Modernization Design

## Goal

Modernize `o2xml` with the package, test, documentation, security, and release
conventions used by `gelf-client`. The published package will support ES modules
and CommonJS, keep its current API, use Bun for development and CI, and publish
through npm Trusted Publishing.

## Current State

`o2xml@0.3.2` uses Yarn 3.5.1 with a tracked zero-install cache, TypeScript
4.9.5, Mocha with ts-node, and a CommonJS-only TypeScript build. The repository
has a tag-only publish workflow that uses Node 18, unpinned actions, and an
`NPM_TOKEN` secret. It has no branch CI workflow, formatter, linter, enforced
coverage, packed consumer test, or Bun lockfile.

`bun audit` and `bun outdated` cannot read the Yarn lockfile. Bun 1.3.14 exits
with `UnsupportedYarnLockfileVersion` before it can inspect dependencies. The
migration must create `bun.lock` before the repository can use Bun's audit
results.

The README shows CommonJS usage and core options but lacks ESM usage, alternative
install commands, TypeScript signatures, error behavior, and development
commands. The migration will check every documented option and example against
the source and tests.

## Public Package Contract

The package will publish these entrypoints:

| Consumer | Package condition | File |
| --- | --- | --- |
| ES modules | `import` | `dist/index.mjs` |
| CommonJS | `require` | `dist/index.cjs` |
| TypeScript | `types` | `dist/types/index.d.ts` |

`package.json` will define `exports` for the package root and retain `main`,
`module`, `types`, and `typings` for compatible tooling.

Both module formats will expose the existing runtime exports, including
`transform` and `TransformObject`. The declarations will export the public
TypeScript types. Existing CommonJS usage will keep working:

```js
const o2xml = require("o2xml");
o2xml.transform({ root: null });
```

ESM consumers will use a named import:

```js
import { transform } from "o2xml";
```

The migration will not add a default export or change transformation output.
The package has no runtime dependencies and will keep that property.

## Toolchain and Dependencies

The repository will remove the Yarn release, plugins, cache, configuration, and
lockfile. `packageManager` will name the Bun version used for the migration, and
`bun.lock` will become the only dependency lockfile.

The migration will update direct development dependencies to current compatible
releases. It will verify the versions against the npm registry during
implementation and record the resolved graph in `bun.lock`. TypeScript 7 will
use explicit ambient types for source and tests.

Moving tests to `bun:test` will remove Mocha, ts-node, and their type packages.
Oxlint will check the TypeScript source, tests, and package scripts. Oxfmt will
format the same tracked files and normalize the existing CRLF files to LF.

## Build

The root `tsconfig.json` will contain shared strict settings and source
boundaries. `tsconfig.esnext.json` and `tsconfig.cjs.json` will type-check the
same source with their respective module semantics.

TypeScript will emit declarations into `dist/types`. Bun will build
`src/index.ts` into `dist/index.mjs` and `dist/index.cjs` with the Node target,
external packages, linked source maps, and syntax minification. The build will
clean stale output first.

A packed-package test will create a tarball, install it in a temporary consumer,
and verify:

- the tarball contains both JavaScript entrypoints, source maps, declarations,
  README, and license;
- Node can call `transform` through ESM and CommonJS;
- TypeScript resolves `transform` and its public option types;
- the packed manifest has no runtime dependencies or build-only metadata.

## Tests and Coverage

The test suite will move from Mocha to `bun:test`. Tests will cover root
validation, node names, nested objects, lists, text fragments, attributes,
pretty output, declarations, formatters, dates, buffers, nulls, unsupported
values, and escaping.

The current transformer removes `@` attribute properties from input objects
while it renders them. Tests will record the current behavior before the
migration changes tooling. The modernization will not change this behavior
without a separate API decision.

`bunfig.toml` will enable coverage, exclude test files, and require 100% lines,
functions, and statements for production code under `src`.

The aggregate `bun run check` command will run formatting checks, linting,
source and test typechecks, unit tests, the dual build, and the packed-package
test.

## Documentation

The implementation will check the README against the source, declarations, and
packed package. It will correct example output, option descriptions, signatures,
return values, and grammar that obscures API behavior.

The installation section will show:

```sh
npm install o2xml
bun add o2xml
yarn add o2xml
```

The usage section will contain working ESM and CommonJS examples. It will
document element names, attribute and text keys, supported scalar and object
values, pretty printing, declarations, formatter callbacks, escaping, buffers,
and thrown errors.

The packed-package test will exercise the same import and require forms shown in
the README. Unit tests will cover the documented transformation behavior.

## Security and CI

`bun run security` will execute `bun audit` without ignored advisories or a
severity filter. The repository will fix direct dependency issues when a safe
release exists. If Bun reports a transitive advisory with no safe resolution,
the implementation report will name the package path, advisory, and available
options rather than suppressing it.

The CI workflow will run for pushes and pull requests. It will use commit-pinned
GitHub actions, minimal read permissions, Bun's frozen install, the strict audit,
and `bun run check`.

## Publishing

The Publish workflow will run for `v*` tags and accept an existing tag through
`workflow_dispatch`. It will check out the exact tag, install with Bun, run the
audit and full check, and use Node 24 with npm to publish.

npm Trusted Publishing will authenticate the publish step through GitHub OIDC.
The workflow will grant `id-token: write` and `contents: read`; it will not read
an `NPM_TOKEN` secret. `npm publish --provenance` will publish the verified
tarball metadata.

This change will not create a release tag, publish a package version, or add an
automatic version-bump workflow.

## Acceptance Criteria

- `bun ci` installs the locked dependency graph without Yarn files.
- `bun run security` completes and reports no known advisory.
- `bun test` reports and enforces 100% lines, functions, and statements for
  production source.
- `bun run build` creates the CJS, ESM, source map, and declaration artifacts.
- Packed ESM, CommonJS, and TypeScript consumers load the documented API.
- `bun run check` passes from a clean checkout.
- CI runs the audit and full check on pushes and pull requests.
- Publish uses npm Trusted Publishing and no registry token secret.
- The README documents npm, Bun, and Yarn installation plus ESM and CommonJS
  usage with correct examples.

## Out of Scope

- changing XML serialization behavior or public export names;
- adding a default export or browser bundle;
- publishing a new npm version;
- automatic semantic-version selection or GitHub Release creation.
