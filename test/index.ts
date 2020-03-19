import * as assert from "assert";
import {transform as o2xml} from "../src";

const ISOString = "2016-03-18T09:56:27.906Z";

describe("Common", () => {
    it("An object should contain one root element", () => {
        assert.throws(() => o2xml({foo: null, bar: null}));
    });

    it("A root element should not be a list", () => {
        assert.throws(() => o2xml({foo: []}));
    });

    it("Empty elements should be self-close", () => {
        assert.equal(o2xml({foo: {}}), "<foo />");
        assert.equal(o2xml({bar: null}), "<bar />");
    });

    it("The Array of objects should be converted to a list of nodes", () => {
        assert.equal(o2xml({foo: {bar: [{foo: null}, {bar: null}]}}), "<foo><bar><foo /></bar><bar><bar /></bar></foo>");
    });

    it("The XML declaration should be written when needed", () => {
        assert.equal(o2xml({foo: null}, {declaration: true}), "<?xml version=\"1.0\" encoding=\"UTF-8\" ?><foo />");
    });
});

describe("Validate tag names", () => {
    it("A root element name should be valid", () => {
        let numberKey: number = 1,
            objectKey: any = {},
            nullKey: any = null;

        assert.throws(() => o2xml({[numberKey]: null}));
        assert.throws(() => o2xml({[objectKey]: null}));
        assert.throws(() => o2xml({[nullKey]: null}));
    });

    it("An element name should be valid", () => {
        assert.throws(() => o2xml({foo: {"1foo": null}}));
        assert.throws(() => o2xml({foo: {"ns:1foo": null}}));
        assert.throws(() => o2xml({foo: {null: null}}));
        assert.doesNotThrow(() => o2xml({foo: {"ns:foo": null}}));
        assert.doesNotThrow(() => o2xml({foo: {":foo": null}}));
        assert.doesNotThrow(() => o2xml({foo: {"foo-bar": null}}));
        assert.doesNotThrow(() => o2xml({foo: {"foo:bar-foo": null}}));
    });

    it("Prefix namespaces should work", () => {
        assert.equal(o2xml({"foo:bar": null}), "<foo:bar />");
        assert.equal(o2xml({":bar": null}), "<bar />");
    });
});

describe("Converting objects", () => {
    it("Dates should be converted to ISO string", () => {
        assert.equal(o2xml({foo: new Date(ISOString)}), "<foo>" + ISOString + "</foo>");
    });

    it("Boolean should be convert true to 1 and false to 0", () => {
        assert.equal(o2xml({foo: true}), "<foo>1</foo>");
        assert.equal(o2xml({foo: false}), "<foo>0</foo>");
    });

    it("Buffer should be encoded in base64", () => {
        let png1px = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        assert.equal(o2xml({foo: new Buffer(png1px, "base64")}), "<foo>" + png1px + "</foo>");
        assert.equal(o2xml({foo: {"@bar": new Buffer(png1px, "base64")}}), "<foo bar=\"" + png1px + "\" />");
    });

    it("Mixed strings, objects and attributes should be valid", () => {
        let mixed = {
            div: {
                "@title": new Date(ISOString),
                "#text1": "Hello",
                span: {
                    "@style": "font-size: 15px",
                    "#text": "World",
                },
                "#text2": "!",
            },
        };

        let resultXML = "<div title=\"" + ISOString + "\">Hello<span style=\"font-size: 15px\">World</span>!</div>";

        assert.equal(o2xml(mixed), resultXML);
    });

    it("Objects can be deep", () => {
        let deepObject = {
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

        let resultXML = "<foo bar=\"1\" foo=\"\"><bar><foo><foo foo=\"1\">Hello</foo><bar><foo>1234567890</foo></bar></foo></bar></foo>";

        assert.equal(o2xml(deepObject), resultXML);
    });
});

describe("Attributes", () => {
    it("Attributes should start with @", () => {
        assert.equal(o2xml({foo: {"@bar": null}}), "<foo bar=\"\" />");
    });

    it("Invalid attributes should thrown an exception", () => {
        assert.throws(() => o2xml({foo: {"@1": null}}));
        assert.throws(() => o2xml({foo: {"@foo": Function}}));
        assert.throws(() => o2xml({foo: {"@foo": Object}}));
    });
});
