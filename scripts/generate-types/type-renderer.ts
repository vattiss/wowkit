// Turns documentation types into TypeScript text: type names, parameter lists, return types and
// doc comments. It counts the type names it could not resolve.
import type { DocField, DocFunction } from "./documentation-shapes.ts";
import type { Documentation } from "./documentation.ts";
import { PRIMITIVES } from "./knowledge.ts";

const RESERVED = new Set(
    (
        "break case catch class const continue debugger default delete do else enum export extends false finally for " +
        "function if import in instanceof new null return super switch this throw true try typeof var void while with " +
        "implements interface let package private protected public static yield arguments eval"
    ).split(" "),
);

export function identifier(name: string): string {
    return RESERVED.has(name) ? `${name}_` : name;
}

export function propertyKey(name: string): string {
    return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

export function nilable(type: string, isNilable: boolean | undefined): string {
    return isNilable ? `${type} | undefined` : type;
}

export function docComment(indent: string, lines: (string | undefined | false)[]): string {
    const text = lines.filter((l): l is string => !!l).map((l) => l.replace(/\*\//g, "*\\/"));
    if (text.length === 0) return "";
    if (text.length === 1) return `${indent}/** ${text[0]} */\n`;
    return `${indent}/**\n${text.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
}

export function functionDoc(indent: string, fn: DocFunction): string {
    return docComment(indent, [
        ...(fn.Documentation ?? []),
        fn.IsProtectedFunction && "@remarks Protected: only callable from secure (untainted) code.",
        fn.HasRestrictions && "@remarks Has restrictions: may fail or be blocked depending on game state.",
    ]);
}

export class TypeRenderer {
    /** Type names the documentation uses but never defines -> how often. */
    readonly unresolved = new Map<string, number>();
    private readonly docs: Documentation;

    constructor(docs: Documentation) {
        this.docs = docs;
    }

    resolveTypeName(name: string): string {
        const primitive = PRIMITIVES[name];
        if (primitive) return primitive;
        const { enums, structures, callbacks, widgetNames, manualTypes, widgetAliases } = this.docs;
        if (enums.has(name)) return `Enum.${name}`;
        if (structures.has(name) || callbacks.has(name) || widgetNames.has(name) || manualTypes.has(name)) return name;
        const widget = widgetAliases.get(name);
        if (widget) return widget;
        this.unresolved.set(name, (this.unresolved.get(name) ?? 0) + 1);
        return name;
    }

    fieldType(field: DocField): string {
        if (field.Mixin) return this.resolveTypeName(field.Mixin);
        if (field.Type === "table" && field.InnerType) {
            const inner = this.resolveTypeName(field.InnerType);
            if (field.KeyType) return `LuaTable<${this.resolveTypeName(field.KeyType)}, ${inner}>`;
            return /^[\w.]+$/.test(inner) ? `${inner}[]` : `(${inner})[]`;
        }
        return this.resolveTypeName(field.Type);
    }

    /** The `...rest: (A | B)[]` of values that repeat (documentation StrideIndex). */
    private renderStride(strided: DocField[]): string {
        const types = [...new Set(strided.map((a) => nilable(this.fieldType(a), a.Nilable)))].join(" | ");
        return `...${identifier(strided[0]!.Name)}: (${types})[]`;
    }

    parameters(args: DocField[] = []): string {
        const strided = args.filter((a) => a.StrideIndex !== undefined);
        const plain = args.filter((a) => a.StrideIndex === undefined);
        // An argument may only be optional (`?`) when every argument after it is optional too
        let optionalFrom = plain.length;
        while (optionalFrom > 0 && (plain[optionalFrom - 1]!.Nilable || plain[optionalFrom - 1]!.Default !== undefined)) {
            optionalFrom--;
        }
        const rendered = plain.map((arg, i) =>
            i >= optionalFrom
                ? `${identifier(arg.Name)}?: ${this.fieldType(arg)}`
                : `${identifier(arg.Name)}: ${nilable(this.fieldType(arg), arg.Nilable)}`,
        );
        if (strided.length > 0) rendered.push(this.renderStride(strided));
        return rendered.join(", ");
    }

    returnType(fn: DocFunction): string {
        const returns = fn.Returns ?? [];
        const strided = returns.filter((r) => r.StrideIndex !== undefined);
        const plain = returns.filter((r) => r.StrideIndex === undefined);
        if (strided.length === 0 && plain.length === 0) return "void";
        if (strided.length === 0 && plain.length === 1) return nilable(this.fieldType(plain[0]!), plain[0]!.Nilable || fn.MayReturnNothing);
        const elements = plain.map((r) => `${identifier(r.Name)}: ${nilable(this.fieldType(r), r.Nilable || fn.MayReturnNothing)}`);
        if (strided.length > 0) elements.push(this.renderStride(strided));
        return `LuaMultiReturn<[${elements.join(", ")}]>`;
    }

    /** `(parameters): returnType`, the signature of a function. */
    signature(fn: DocFunction): string {
        return `(${this.parameters(fn.Arguments)}): ${this.returnType(fn)}`;
    }
}
