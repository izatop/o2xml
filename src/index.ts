"use strict";

import { Buffer } from "node:buffer";

export interface AnyObject<Root = any> {
    [root: string]: Root;
}

export interface TransformFormatter<T> {
    (value: T): string;
}

interface TransformFormatters {
    string?: TransformFormatter<string>;
    number?: TransformFormatter<number>;
    date?: TransformFormatter<Date>;
    boolean?: TransformFormatter<boolean>;
}

export interface TransformOptions {
    pretty?: boolean;
    indent?: string;
    declaration?: boolean;
    formatters?: TransformFormatters;
}

type NormalizedOptions = {
    pretty: boolean;
    indent: string;
    formatters: Required<Omit<TransformFormatters, "date">> & Pick<TransformFormatters, "date">;
};

const validateElementName = (name: string): boolean => {
    return (
        null !== name &&
        /^([a-z][a-z0-9_\-.]*(:[a-z][a-z0-9_\-.]*)?|:[a-z][a-z0-9_\-.:]*)$/i.test(name)
    );
};

const repeat = (string: string, repeat: number): string => {
    let result = "";
    for (let i = 0; i < repeat; i++) {
        result += string;
    }

    return result;
};

const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
    if (typeof obj == "object" && obj !== null) {
        if (typeof Object.getPrototypeOf == "function") {
            const proto = Object.getPrototypeOf(obj);
            return proto === Object.prototype || proto === null;
        }

        return Object.prototype.toString.call(obj) == "[object Object]";
    }

    return false;
};

const escapeStringReg = /["'&<>]/g;
const escapeStringCodes: Record<string, string> = {
    '"': "&quot;",
    "'": "&#39;",
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
};
const escapeString = (string: string): string => {
    return string.replace(escapeStringReg, (char: string): string => {
        return escapeStringCodes[char] || char;
    });
};

const transform = (object: AnyObject, options?: TransformOptions): string => {
    if (Object.keys(object).length !== 1) {
        throw new Error("Object must have one the root element.");
    }

    // Check a key for null because Object.keys returns null as a string "null"
    if ((null as unknown as PropertyKey) in object) {
        throw new Error("Null cannot be a root element name.");
    }

    const rootNodeName = Object.keys(object)[0];
    const rootElement = new TransformObject(rootNodeName, object[rootNodeName], options);

    return rootElement.transform();
};

class TransformObject<Children = any> {
    name: string;
    children: Children;
    options: TransformOptions;
    private normalizedOptions: NormalizedOptions;

    constructor(name: string, children: Children, options?: TransformOptions) {
        this.name = name;
        this.children = children;
        this.options = options || {};
        this.normalizedOptions = this.options as NormalizedOptions;

        if (Array.isArray(children)) {
            throw new Error("Root element cannot be a list");
        }

        if (false === this.options.hasOwnProperty("formatters")) {
            this.normalizedOptions.formatters = {} as NormalizedOptions["formatters"];
        }

        if (typeof this.normalizedOptions.formatters.boolean !== "function") {
            this.normalizedOptions.formatters.boolean = (value: boolean) =>
                Number(value).toString();
        }

        if (typeof this.normalizedOptions.formatters.string !== "function") {
            this.normalizedOptions.formatters.string = escapeString;
        }

        if (typeof this.normalizedOptions.formatters.number !== "function") {
            this.normalizedOptions.formatters.number = (value: number) => value.toString();
        }

        if (false === this.options.hasOwnProperty("pretty")) {
            this.normalizedOptions.pretty = false;
        }

        if (false === this.options.hasOwnProperty("indent")) {
            this.normalizedOptions.indent = "  ";
        }
    }

    transform(): string {
        if (this.options.declaration) {
            return (
                '<?xml version="1.0" encoding="UTF-8" ?>' +
                (this.normalizedOptions.pretty ? "\n" : "") +
                this.createNode(this.name, this.children, -1)
            );
        }

        return this.createNode(this.name, this.children, -1);
    }

    private createNode(node: string, children?: unknown, level: number = -1): string {
        let returnString = "";
        if (Array.isArray(children)) {
            returnString = children.map((value) => this.createNode(node, value, level)).join("");
        } else {
            switch (typeof children) {
                case "object": {
                    const attributes: Record<string, unknown> = {};
                    if (isPlainObject(children)) {
                        Object.keys(children).forEach((key) => {
                            if (typeof key === "string" && key.charCodeAt(0) === 64) {
                                attributes[key] = children[key];
                                delete children[key];
                            }
                        });
                    }

                    returnString = this.wrapNode(
                        level + 1,
                        node,
                        this.getObjectNode(children, level),
                        this.getObjectAttributes(attributes),
                    );
                    break;
                }
                case "string":
                    if (node.charCodeAt(0) == 35) {
                        return this.getStringNode(children);
                    }

                    returnString = this.wrapNode(level + 1, node, this.getStringNode(children));
                    break;
                case "number":
                    returnString = this.wrapNode(level + 1, node, this.getNumberNode(children));
                    break;
                case "boolean":
                    returnString = this.wrapNode(level + 1, node, this.getBooleanNode(children));
                    break;
                default:
                    returnString = this.wrapNode(level + 1, node, `<!-- ${typeof children} -->`);
            }
        }

        return returnString;
    }

    private getObjectNode(object: unknown, level: number = -1): string {
        if (object === null) {
            return "";
        } else if (isPlainObject(object)) {
            // Check a key for null because Object.keys returns null as a string "null"
            if ((null as unknown as PropertyKey) in object) {
                throw new Error("Null cannot be an element name.");
            }

            return Object.keys(object)
                .map((node) => this.createNode(node, object[node], level + 1))
                .join("");
        } else if (Buffer.isBuffer(object)) {
            // check for Node.js Buffer
            return object.toString("base64");
        } else if (object instanceof Date) {
            if (this.normalizedOptions.formatters.date) {
                return this.normalizedOptions.formatters.date(object);
            }

            return object.toISOString();
        } else {
            throw new TypeError(
                "Cannot convert object to Node: " + (object as { toString(): string }).toString(),
            );
        }
    }

    private getObjectAttributes(object: Record<string, unknown>): string {
        const attributes: Array<{ key: string; value: string }> = [];
        Object.keys(object).forEach((key) => {
            const name = key.substr(1);
            const attributeValue = object[key];
            let value: string;

            if (false === validateElementName(name)) {
                throw new Error(`An element name "${name}" is not valid`);
            }

            switch (typeof attributeValue) {
                case "string":
                    value = this.getStringNode(attributeValue);
                    break;
                case "number":
                    value = this.getNumberNode(attributeValue);
                    break;
                case "boolean":
                    value = this.getBooleanNode(attributeValue);
                    break;
                default:
                    if (attributeValue === null) {
                        value = "";
                    } else if (attributeValue instanceof Date) {
                        if (this.normalizedOptions.formatters.date) {
                            value = this.normalizedOptions.formatters.date(attributeValue);
                        } else {
                            value = attributeValue.toISOString();
                        }
                    } else if (Buffer.isBuffer(attributeValue)) {
                        // check for Node.js Buffer
                        value = attributeValue.toString("base64");
                    } else {
                        throw new Error(
                            `Invalid an attribute "${name}" value: ${typeof attributeValue}`,
                        );
                    }
            }

            attributes.push({ key: name, value });
        });

        return attributes.map((x) => `${x.key}="${x.value}"`).join(" ");
    }

    private getStringNode(value: string): string {
        if (this.normalizedOptions.formatters.string) {
            return this.normalizedOptions.formatters.string(value);
        }

        return value;
    }

    private getNumberNode(value: number): string {
        if (this.normalizedOptions.formatters.number) {
            return this.normalizedOptions.formatters.number(value);
        }

        return value.toString(10);
    }

    private getBooleanNode(value: boolean): string {
        if (this.normalizedOptions.formatters.boolean) {
            return this.normalizedOptions.formatters.boolean(value);
        }

        return value.toString();
    }

    private wrapNode(level: number, name: string, content?: string, attributes?: string): string {
        if (false === validateElementName(name)) {
            throw new Error(`An element name "${name}" is not valid`);
        }

        if (name.substr(0, 1) === ":") {
            name = name.substr(1); // local name
        }

        if (this.normalizedOptions.pretty) {
            if (typeof content === "string" && content.length > 0) {
                const hasChild =
                    content.indexOf(repeat(this.normalizedOptions.indent, level + 1) + "<") === 0;
                return (
                    `${repeat(this.normalizedOptions.indent, level)}` +
                    `<${name}${attributes ? " " + attributes : ""}>` +
                    `${hasChild ? "\n" : ""}${content}` +
                    `${hasChild ? repeat(this.normalizedOptions.indent, level) : ""}</${name}>\n`
                );
            }

            return `<${name}${attributes ? " " + attributes : ""} />`;
        }

        if (typeof content === "string" && content.length > 0) {
            return `<${name}${attributes ? " " + attributes : ""}>${content}</${name}>`;
        }

        return `<${name}${attributes ? " " + attributes : ""} />`;
    }
}

export { TransformObject, transform };
