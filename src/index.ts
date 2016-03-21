'use strict';

declare var Buffer:any;

interface AnyObject {
    [root:string]:any;
}

interface TransformFormatter<T> {
    (value:T):string;
}

interface TransformOptions {
    pretty?:boolean;
    indent?:string;
    declaration?:boolean;
    formatters?: {
        string?:TransformFormatter<string>;
        number?:TransformFormatter<number>;
        date?:TransformFormatter<Date>;
        boolean?:TransformFormatter<boolean>;
    }
}

const validateElementName = (name:string) => {
    return null !== name && true === /^([a-z][a-z0-9_\-\.]*(:[a-z][a-z0-9_\-\.]+)?|:[a-z][a-z0-9_\-\.:]*)$/i.test(name);
};

const repeat = (string:string, repeat:number) => {
    let result:string = '';
    for (let i = 0; i < repeat; i++) {
        result += string;
    }

    return result;
};

const isPlainObject = (obj:any):boolean => {
    if (typeof obj == 'object' && obj !== null) {
        if (typeof Object.getPrototypeOf == 'function') {
            let proto:any = Object.getPrototypeOf(obj);
            return proto === Object.prototype || proto === null;
        }

        return Object.prototype.toString.call(obj) == '[object Object]';
    }

    return false;
};

const escapeStringReg = /["'&<>]/g;
const escapeStringCodes = {'"': '&quot;', '\'': '&#39;', '&': '&amp;', '<': '&lt;', '>': '&gt;'};
const escapeString = (string:string):string => {
    return string.replace(escapeStringReg, (char:string):string => {
        return escapeStringCodes[char] || char;
    });
};

const transform = (object:AnyObject, options?:TransformOptions) => {
    if (Object.keys(object).length !== 1) {
        throw new Error('Object must have one the root element.')
    }

    // Check a key for null because Object.keys returns null as a string "null"
    if (<any> null in object) {
        throw new Error('Null cannot be a root element name.');
    }

    let rootNodeName:string = Object.keys(object)[0],
        rootElement = new TransformObject(rootNodeName, object[rootNodeName], options);

    return rootElement.transform();
};

class TransformObject {
    name:string;
    children:any;
    options:TransformOptions;

    constructor(name:string, children:any, options?:TransformOptions) {
        this.name = name;
        this.children = children;
        this.options = options || {};

        if (Array.isArray(children)) {
            throw new Error('Root element cannot be a list');
        }

        if (false === this.options.hasOwnProperty('formatters')) {
            this.options.formatters = {};
        }

        if (typeof this.options.formatters.boolean !== "function") {
            this.options.formatters.boolean = (v:boolean) => parseInt(<any> v + 0).toString();
        }

        if (typeof this.options.formatters.string !== "function") {
            this.options.formatters.string = escapeString;
        }

        if (typeof this.options.formatters.number !== "function") {
            this.options.formatters.number = (v:number) => v.toString();
        }

        if (false === this.options.hasOwnProperty('pretty')) {
            this.options.pretty = false;
        }

        if (false === this.options.hasOwnProperty('indent')) {
            this.options.indent = "  ";
        }
    }

    transform() {
        if (this.options.declaration) {
            return '<?xml version="1.0" encoding="UTF-8" ?>' + (this.options.pretty ? "\n" : "")
                + this.createNode(this.name, this.children, -1);
        }

        return this.createNode(this.name, this.children, -1);
    }

    private createNode(node:string, children?:any, level?:number):string {
        let returnString = '';
        if (Array.isArray(children)) {
            returnString = children.map(value => this.createNode(node, value, level)).join('');
        } else {
            switch (typeof children) {
                case 'object':
                    let attributes = {};
                    if (isPlainObject(children)) {
                        Object.keys(children)
                            .forEach(key => {
                                if (typeof key === "string" && key.charCodeAt(0) === 64) {
                                    attributes[key] = children[key];
                                    delete children[key];
                                }
                            });
                    }

                    returnString = this.wrapNode(level + 1, node, this.getObjectNode(children, level), this.getObjectAttributes(attributes));
                    break;
                case 'string':
                    if (node.charCodeAt(0) == 35) {
                        return this.getStringNode(children);
                    }

                    returnString = this.wrapNode(level+1, node, this.getStringNode(children));
                    break;
                case 'number':
                    returnString = this.wrapNode(level+1, node, this.getNumberNode(children));
                    break;
                case 'boolean':
                    returnString = this.wrapNode(level+1, node, this.getBooleanNode(children));
                    break;
                default:
                    returnString = this.wrapNode(level+1, node, `<!-- ${typeof children} -->`);
            }
        }

        return returnString;
    };

    private getObjectNode(object:any, level?:number):string {
        if (object === null) {
            return '';
        } else if (isPlainObject(object)) {
            // Check a key for null because Object.keys returns null as a string "null"
            if (<any> null in object) {
                throw new Error('Null cannot be an element name.');
            }

            return Object.keys(object)
                .map(node => this.createNode(node, object[node], level + 1))
                .join('');
        } else if (Buffer && Buffer.isBuffer(object)) { // check for Node.js Buffer
            return object.toString('base64');
        } else if (object instanceof Date) {
            if (this.options.formatters.date) {
                return this.options.formatters.date(object);
            }

            return object.toISOString();
        } else {
            throw new TypeError('Cannot convert object to Node: ' + object.toString());
        }
    }

    private getObjectAttributes(object:any) {
        let attributes:Array<{key:string, value:string}> = [];
        Object.keys(object).forEach(key => {
            let name = key.substr(1),
                value;

            if (false === validateElementName(name)) {
                throw new Error(`An element name "${name}" is not valid`);
            }

            switch (typeof object[key]) {
                case 'string':
                    value = this.getStringNode(object[key]);
                    break;
                case 'number':
                    value = this.getNumberNode(object[key]);
                    break;
                case 'boolean':
                    value = this.getBooleanNode(object[key]);
                    break;
                default:
                    if (object[key] === null) {
                        value = '';
                    } else if (object[key] instanceof Date) {
                        if (this.options.formatters.date) {
                            value = this.options.formatters.date(object[key]);
                        } else {
                            value = object[key].toISOString();
                        }
                    } else if (Buffer && Buffer.isBuffer(object[key])) { // check for Node.js Buffer
                        value = object[key].toString('base64');
                    } else {
                        throw new Error(`Invalid an attribute "${name}" value: ${typeof object[key]}`);
                    }
            }

            attributes.push({key: name, value});
        });

        return attributes.map(x => `${x.key}="${x.value}"`).join(' ');
    }

    private getStringNode(value:string):string {
        if (this.options.formatters.string) {
            return this.options.formatters.string(value);
        }

        return value;
    }

    private getNumberNode(value:number):string {
        if (this.options.formatters.number) {
            return this.options.formatters.number(value);
        }

        return value.toString(10);
    }

    private getBooleanNode(value:boolean):string {
        if (this.options.formatters.boolean) {
            return this.options.formatters.boolean(value);
        }

        return value.toString();
    }

    private wrapNode(level:number, name:string, content?:string, attributes?:string) {
        if (false === validateElementName(name)) {
            throw new Error(`An element name "${name}" is not valid`);
        }

        if (name.substr(0, 1) === ":") {
            name = name.substr(1); // local name
        }

        if (this.options.pretty) {
            if (typeof content === "string" && content.length > 0) {
                let hasChild = content.indexOf(repeat(this.options.indent, level + 1) + '<') === 0;
                return `${repeat(this.options.indent, level)}`
                    + `<${name}${attributes?' '+attributes:''}>`
                    + `${hasChild ? "\n" : ""}${content}`
                    + `${hasChild ? repeat(this.options.indent, level) : ""}</${name}>\n`;
            }

            return `<${name}${attributes?' '+attributes:''} />`;
        }

        if (typeof content === "string" && content.length > 0) {
            return `<${name}${attributes?' '+attributes:''}>${content}</${name}>`;
        }

        return `<${name}${attributes?' '+attributes:''} />`;
    }
}

export {transform, TransformObject, TransformOptions};