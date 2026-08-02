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
