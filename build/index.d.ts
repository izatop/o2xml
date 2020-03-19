interface AnyObject {
    [root: string]: any;
}
interface TransformFormatter<T> {
    (value: T): string;
}
interface TransformOptions {
    pretty?: boolean;
    indent?: string;
    declaration?: boolean;
    formatters?: {
        string?: TransformFormatter<string>;
        number?: TransformFormatter<number>;
        date?: TransformFormatter<Date>;
        boolean?: TransformFormatter<boolean>;
    };
}
declare const transform: (object: AnyObject, options?: TransformOptions) => string;
declare class TransformObject {
    name: string;
    children: any;
    options: TransformOptions;
    constructor(name: string, children: any, options?: TransformOptions);
    transform(): string;
    private createNode;
    private getObjectNode;
    private getObjectAttributes;
    private getStringNode;
    private getNumberNode;
    private getBooleanNode;
    private wrapNode;
}
export { AnyObject, TransformFormatter, TransformOptions, TransformObject, transform };
