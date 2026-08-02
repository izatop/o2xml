import type { TransformObject } from "../src";

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
        ? (<Value>() => Value extends Right ? 1 : 2) extends
            (<Value>() => Value extends Left ? 1 : 2)
            ? true
            : false
        : false;

type Assert<Value extends true> = Value;

export type TransformObjectDeclarationOptionIsOptional = Assert<
    Equal<TransformObject["options"]["declaration"], boolean | undefined>
>;
