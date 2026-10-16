// Turns the data-only Lua files of Blizzard_APIDocumentationGenerated into plain JS values.
// Each file looks like `local X = { ... }; APIDocumentation:AddDocumentationTable(X);`.
import luaparse from "luaparse";
import type { Expression } from "luaparse";

export type LuaValue = string | number | boolean | null | LuaExpression | LuaValue[] | { [key: string]: LuaValue };

/** A non-literal expression (e.g. `Enum.Foo.Bar` or `A - B + 1`), kept as its source text. */
export class LuaExpression {
    readonly text: string;
    constructor(text: string) {
        this.text = text;
    }
}

export function parseDocumentationFile(source: string): { [key: string]: LuaValue } {
    const chunk = luaparse.parse(source, { luaVersion: "5.1", encodingMode: "pseudo-latin1", ranges: true });
    for (const statement of chunk.body) {
        if (statement.type === "LocalStatement" && statement.init[0]?.type === "TableConstructorExpression") {
            const value = toValue(statement.init[0], source);
            if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof LuaExpression)) {
                return value;
            }
        }
    }
    throw new Error("no `local X = { ... }` documentation table found");
}

function toValue(node: Expression, source: string): LuaValue {
    switch (node.type) {
        case "StringLiteral":
            // pseudo-latin1 maps each byte to one char; restore the original UTF-8 text
            return Buffer.from(node.value ?? "", "latin1").toString("utf8");
        case "NumericLiteral":
        case "BooleanLiteral":
            return node.value;
        case "NilLiteral":
            return null;
        case "UnaryExpression":
            if (node.operator === "-" && node.argument.type === "NumericLiteral") return -node.argument.value;
            return expression(node, source);
        case "Identifier":
        case "MemberExpression":
        case "BinaryExpression":
            return expression(node, source);
        case "TableConstructorExpression": {
            const list: LuaValue[] = [];
            const record: { [key: string]: LuaValue } = {};
            for (const field of node.fields) {
                if (field.type === "TableValue") list.push(toValue(field.value, source));
                else if (field.type === "TableKeyString") record[field.key.name] = toValue(field.value, source);
                else throw new Error("computed table keys are not supported");
            }
            if (Object.keys(record).length === 0) return list;
            if (list.length > 0) throw new Error("mixed array/record tables are not supported");
            return record;
        }
        default:
            throw new Error(`unsupported expression type ${node.type}`);
    }
}

function expression(node: Expression, source: string): LuaExpression {
    // Present because we parse with `ranges: true`; @types/luaparse does not declare it
    const [start, end] = (node as Expression & { range: [number, number] }).range;
    return new LuaExpression(source.slice(start, end));
}
