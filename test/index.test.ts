import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { transform } from "../src";

const ISO_STRING = "2016-03-18T09:56:27.906Z";

describe("transform", () => {
    test("serializes nested values and attributes while removing attributes from the input", () => {
        const input = {
            root: {
                "@enabled": true,
                item: [{ "#text": "one" }, { "#text": "two" }],
            },
        };

        expect(transform(input)).toBe('<root enabled="1"><item>one</item><item>two</item></root>');
        expect(input.root).not.toHaveProperty("@enabled");
    });

    test("requires exactly one root element", () => {
        expect(() => transform({ foo: null, bar: null })).toThrow(
            "Object must have one the root element.",
        );
    });

    test("rejects a root list", () => {
        expect(() => transform({ foo: [] })).toThrow("Root element cannot be a list");
    });

    test("self-closes empty elements", () => {
        expect(transform({ foo: {} })).toBe("<foo />");
        expect(transform({ bar: null })).toBe("<bar />");
    });

    test("serializes child arrays as repeated nodes", () => {
        expect(transform({ foo: { bar: [{ foo: null }, { bar: null }] } })).toBe(
            "<foo><bar><foo /></bar><bar><bar /></bar></foo>",
        );
    });

    test("writes an XML declaration", () => {
        expect(transform({ foo: null }, { declaration: true })).toBe(
            '<?xml version="1.0" encoding="UTF-8" ?><foo />',
        );
    });

    test("rejects invalid root names", () => {
        expect(() => transform({ 1: null })).toThrow('An element name "1" is not valid');
        expect(() => transform({ "[object Object]": null })).toThrow(
            'An element name "[object Object]" is not valid',
        );
        expect(() => transform({ null: null })).toThrow("Null cannot be a root element name.");
    });

    test("rejects invalid child names and preserves valid namespace names", () => {
        expect(() => transform({ foo: { "1foo": null } })).toThrow(
            'An element name "1foo" is not valid',
        );
        expect(() => transform({ foo: { "ns:1foo": null } })).toThrow(
            'An element name "ns:1foo" is not valid',
        );
        expect(() => transform({ foo: { null: null } })).toThrow("Null cannot be an element name.");
        expect(
            transform({
                foo: { "ns:foo": null, ":foo": null, "foo-bar": null, "foo:bar-foo": null },
            }),
        ).toBe("<foo><ns:foo /><foo /><foo-bar /><foo:bar-foo /></foo>");
    });

    test("serializes namespace-prefixed root names", () => {
        expect(transform({ "foo:bar": null })).toBe("<foo:bar />");
        expect(transform({ ":bar": null })).toBe("<bar />");
    });

    test("serializes dates with the ISO formatter", () => {
        expect(transform({ foo: new Date(ISO_STRING) })).toBe(`<foo>${ISO_STRING}</foo>`);
    });

    test("serializes booleans as zero and one", () => {
        expect(transform({ foo: true })).toBe("<foo>1</foo>");
        expect(transform({ foo: false })).toBe("<foo>0</foo>");
    });

    test("serializes buffers in node content and attributes", () => {
        const pixel =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

        expect(transform({ foo: Buffer.from(pixel, "base64") })).toBe(`<foo>${pixel}</foo>`);
        expect(transform({ foo: { "@bar": Buffer.from(pixel, "base64") } })).toBe(
            `<foo bar="${pixel}" />`,
        );
    });

    test("serializes mixed text, elements, and attributes", () => {
        const input = {
            div: {
                "@title": new Date(ISO_STRING),
                "#text1": "Hello",
                span: {
                    "@style": "font-size: 15px",
                    "#text": "World",
                },
                "#text2": "!",
            },
        };

        expect(transform(input)).toBe(
            `<div title="${ISO_STRING}">Hello<span style="font-size: 15px">World</span>!</div>`,
        );
    });

    test("serializes deeply nested elements and attributes", () => {
        const input = {
            foo: {
                "@bar": 1,
                "@foo": null,
                bar: {
                    foo: {
                        foo: {
                            "@foo": 1,
                            "#text": "Hello",
                        },
                        bar: {
                            foo: 1234567890,
                        },
                    },
                },
            },
        };

        expect(transform(input)).toBe(
            '<foo bar="1" foo=""><bar><foo><foo foo="1">Hello</foo><bar><foo>1234567890</foo></bar></foo></bar></foo>',
        );
    });

    test("serializes null attributes as empty strings", () => {
        expect(transform({ foo: { "@bar": null } })).toBe('<foo bar="" />');
    });

    test("rejects invalid attribute names", () => {
        expect(() => transform({ foo: { "@1": null } })).toThrow(
            'An element name "1" is not valid',
        );
    });

    test("rejects unsupported attribute values", () => {
        expect(() => transform({ foo: { "@foo": /unsupported/ } })).toThrow(
            'Invalid an attribute "foo" value: object',
        );
        expect(() => transform({ foo: { "@foo": Function } })).toThrow(
            'Invalid an attribute "foo" value: function',
        );
    });

    test("escapes quotes, apostrophes, ampersands, and angle brackets", () => {
        expect(transform({ root: { "@value": "\"'&<>", "#text": "\"'&<>" } })).toBe(
            '<root value="&quot;&#39;&amp;&lt;&gt;">&quot;&#39;&amp;&lt;&gt;</root>',
        );
    });

    test("serializes zero, false, empty strings, and null children", () => {
        expect(transform({ root: { zero: 0, false: false, empty: "", nil: null } })).toBe(
            "<root><zero>0</zero><false>0</false><empty /><nil /></root>",
        );
    });

    test("uses custom scalar formatters and pretty-print options", () => {
        expect(
            transform(
                {
                    root: {
                        "@date": new Date("2020-01-01T00:00:00.000Z"),
                        value: 2,
                        enabled: false,
                        text: "mixed",
                    },
                },
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
        ).toBe(
            '<?xml version="1.0" encoding="UTF-8" ?>\n<root date="DATE">\n\t<value>n:2</value>\n\t<enabled>false</enabled>\n\t<text>MIXED</text>\n</root>\n',
        );
    });

    test("pretty-prints empty content without indentation", () => {
        expect(transform({ root: null }, { pretty: true })).toBe("<root />");
    });

    test("serializes plain objects with a null prototype", () => {
        const child = Object.create(null) as Record<string, unknown>;
        child["@kind"] = "plain";
        child["#text"] = "text";

        expect(transform({ root: child })).toBe('<root kind="plain">text</root>');
    });

    test("uses the plain-object fallback when Object.getPrototypeOf is unavailable", () => {
        const originalGetPrototypeOf = Object.getPrototypeOf;
        Object.getPrototypeOf = undefined as unknown as typeof Object.getPrototypeOf;

        try {
            expect(transform({ root: { "#text": "fallback" } })).toBe("<root>fallback</root>");
        } finally {
            Object.getPrototypeOf = originalGetPrototypeOf;
        }
    });

    test("rejects unsupported object children", () => {
        expect(() => transform({ root: /unsupported/ })).toThrow(TypeError);
    });

    test("renders unsupported scalar values as type comments", () => {
        expect(transform({ root: undefined })).toContain("<!-- undefined -->");
    });
});
