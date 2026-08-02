# o2xml

`o2xml` converts a JavaScript object tree into XML. It has no runtime dependencies and provides ESM, CommonJS, and TypeScript declarations.

## Install

Use the command for your package manager:

```sh
npm install o2xml
bun add o2xml
yarn add o2xml
```

## Use

ESM:

```ts
import { transform } from "o2xml";

const xml = transform({ root: { "@id": 1, "#text": "value" } });

console.log(xml);
// <root id="1">value</root>
```

CommonJS:

```js
const { transform } = require("o2xml");

const xml = transform({ root: { "@id": 1, "#text": "value" } });

console.log(xml);
// <root id="1">value</root>
```

The packed package exposes the same `transform` and `TransformObject` runtime exports in both module formats.

## Object model

The input must have exactly one enumerable root property, and the root value cannot be an array. Plain-object keys become elements. Keys beginning with `@` become attributes on that object’s element; a string-valued key beginning with `#` becomes a text fragment, without an enclosing element. Text fragments and elements are emitted in property order.

```ts
const xml = transform({
    div: {
        "@id": "greeting",
        "#text": "Hello, ",
        span: { "@style": "font-weight: bold", "#text": "World" },
        "#tail": "!",
    },
});

console.log(xml);
// <div id="greeting">Hello, <span style="font-weight: bold">World</span>!</div>
```

Children can be strings, numbers, booleans, `null`, plain objects, arrays, `Date` instances, or Node.js `Buffer` instances. Arrays repeat the element for each item; dates use `toISOString()` by default; buffers use base64. `true` and `false` become `1` and `0`. Empty strings and `null` produce self-closing elements, and a `null` attribute becomes an empty string.

By default, strings and attribute strings escape `"`, `'`, `&`, `<`, and `>`. Element and attribute names are validated. The transformer throws for an input without exactly one root, an array root, invalid names, unsupported attribute values, and unsupported object children such as regular expressions.

### Input mutation

During transformation, `@` properties are consumed from plain-object nodes: they are read as attributes and removed from those input objects. Clone the object first if you need to retain those properties after calling `transform`.

## Options and formatters

`transform(object, options)` accepts these options:

- `pretty` — formats nested elements with newlines and indentation; default: `false`.
- `indent` — indentation used by `pretty`; default: two spaces.
- `declaration` — prepends `<?xml version="1.0" encoding="UTF-8" ?>`; default: `false`.
- `formatters` — optional callbacks for `string`, `number`, `boolean`, and `date` values. Each callback receives the value and returns the XML text to use.

```ts
import type { AnyObject, TransformFormatter, TransformOptions } from "o2xml";

const number: TransformFormatter<number> = (value) => `n:${value}`;
const options: TransformOptions = {
    pretty: true,
    indent: "\t",
    declaration: true,
    formatters: {
        number,
        boolean: String,
        date: () => "DATE",
        string: (value) => value.toUpperCase(),
    },
};
const value: AnyObject = { root: { value: 2 } };

transform(value, options);
```

`AnyObject` describes the input shape, `TransformFormatter<T>` describes a formatter callback, and `TransformOptions` describes the optional second argument. A custom string formatter replaces the default escaping, so it must escape XML itself when needed.

## Development

This repository uses Bun:

```sh
bun install
bun run security
bun test
bun run build
bun run check
```
