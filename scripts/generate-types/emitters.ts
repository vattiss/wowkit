// One emitter for each generated file: it renders the sorted documentation as TypeScript text.
import { readFileSync } from "node:fs";
import { CACHE_DIR, readWowUiSource } from "../lib/paths.ts";
import type { DocFunction } from "./documentation-shapes.ts";
import type { Documentation } from "./documentation.ts";
import { MANUAL_METHODS, SIGNATURE_OVERRIDES, WIDGETS } from "./knowledge.ts";
import { docComment, functionDoc, identifier, nilable, propertyKey, type TypeRenderer } from "./type-renderer.ts";

export interface EmitContext {
    docs: Documentation;
    renderer: TypeRenderer;
    /** The comment at the top of every generated file. */
    header: (description: string) => string;
}

export function createHeader(): (description: string) => string {
    const source = readWowUiSource();
    const gameVersion = readFileSync(`${CACHE_DIR}/version.txt`, "utf8").trim();
    return (description) =>
        `// GENERATED FILE - do not edit. Regenerate with "pnpm gen:types".\n` +
        `// ${description}\n` +
        `// Source: ${source.repository} (${source.branch} @ ${source.commit.slice(0, 10)}), game version ${gameVersion}\n\n`;
}

const byName = (a: { Name: string }, b: { Name: string }) => a.Name.localeCompare(b.Name);

/** The functions of every system, by namespace ("" for the globals). */
function groupFunctionsByNamespace(docs: Documentation): [namespace: string, functions: DocFunction[]][] {
    const byNamespace = new Map<string, DocFunction[]>();
    for (const system of docs.systems) {
        if (system.Type !== "System") continue;
        const list = byNamespace.get(system.Namespace ?? "") ?? [];
        list.push(...(system.Functions ?? []));
        byNamespace.set(system.Namespace ?? "", list);
    }
    return [...byNamespace].sort(([a], [b]) => a.localeCompare(b));
}

function emitNamespace(renderer: TypeRenderer, namespace: string, functions: DocFunction[]): string {
    const indent = namespace ? "    " : "";
    const keyword = namespace ? "function" : "declare function";
    let out = namespace ? `declare namespace ${namespace} {\n` : "";
    for (const fn of functions.sort(byName)) {
        const signature = SIGNATURE_OVERRIDES[namespace ? `${namespace}.${fn.Name}` : fn.Name] ?? renderer.signature(fn);
        out += functionDoc(indent, fn) + `${indent}${keyword} ${fn.Name}${signature};\n`;
    }
    return out + (namespace ? "}\n" : "") + "\n";
}

function emitConstants({ docs, renderer }: EmitContext): string {
    let out = "declare namespace Constants {\n";
    for (const table of [...docs.constants.values()].sort(byName)) {
        out += `    namespace ${table.Name} {\n`;
        for (const value of table.Values ?? []) {
            const literal =
                typeof value.Value === "number" || typeof value.Value === "string"
                    ? JSON.stringify(value.Value)
                    : renderer.fieldType(value);
            out += `        const ${value.Name}: ${literal};\n`;
        }
        out += "    }\n";
    }
    return out + "}\n";
}

export function emitApi(context: EmitContext): string {
    let out = context.header("Global functions and C_* namespaces.") + "/** @noSelfInFile */\n\n";
    for (const [namespace, functions] of groupFunctionsByNamespace(context.docs)) {
        if (functions.length > 0) out += emitNamespace(context.renderer, namespace, functions);
    }
    return out + emitConstants(context);
}

export function emitEnums({ docs, header }: EmitContext): string {
    let out = header("Enum.* tables.") + "declare namespace Enum {\n";
    for (const table of [...docs.enums.values()].sort(byName)) {
        out += docComment("    ", table.Documentation ?? []) + `    enum ${table.Name} {\n`;
        for (const field of table.Fields ?? []) {
            out += docComment("        ", field.Documentation ?? []) + `        ${propertyKey(field.Name)} = ${field.EnumValue},\n`;
        }
        out += "    }\n";
    }
    return out + "}\n";
}

export function emitStructures({ docs, renderer, header }: EmitContext): string {
    let out = header("Structures and callback types.") + "/** @noSelfInFile */\n\n";
    for (const table of [...docs.structures.values()].sort(byName)) {
        out += docComment("", table.Documentation ?? []) + `interface ${table.Name} {\n`;
        for (const field of table.Fields ?? []) {
            const optional = field.Nilable ? "?" : "";
            out +=
                docComment("    ", field.Documentation ?? []) +
                `    ${propertyKey(field.Name)}${optional}: ${renderer.fieldType(field)};\n`;
        }
        out += "}\n\n";
    }
    for (const table of [...docs.callbacks.values()].sort(byName)) {
        out +=
            docComment("", table.Documentation ?? []) +
            `type ${table.Name} = (this: void, ${renderer.parameters(table.Arguments)}) => void;\n`;
    }
    return out.replace(/\(this: void, \)/g, "(this: void)");
}

export function emitEvents({ docs, renderer, header }: EmitContext): string {
    let out = header("Event payloads, keyed by event name.") + "interface WowEventPayloads {\n";
    for (const [name, event] of [...docs.events].sort(([a], [b]) => a.localeCompare(b))) {
        const payload = (event.Payload ?? []).map((p) => `${identifier(p.Name)}: ${nilable(renderer.fieldType(p), p.Nilable)}`);
        out += docComment("    ", [
            ...(event.Documentation ?? []),
            event.SynchronousEvent && "@remarks Synchronous event.",
            event.UniqueEvent && "@remarks Unique event: only the most recent one is delivered per frame.",
        ]);
        out += `    ${name}: [${payload.join(", ")}];\n`;
    }
    return out + "}\n\n/** Any event name the client can fire. */\ntype WowEvent = keyof WowEventPayloads;\n";
}

/** Method name -> its signatures, for a widget and everything it extends. */
type Methods = Map<string, string[]>;

/** The methods of the bases, merged: what a widget inherits. */
function mergeInheritedMethods(bases: string[], signaturesOf: Map<string, Methods>): Methods {
    const inherited: Methods = new Map();
    for (const base of bases) {
        for (const [method, signatures] of signaturesOf.get(base) ?? []) {
            inherited.set(method, [...new Set([...(inherited.get(method) ?? []), ...signatures])]);
        }
    }
    return inherited;
}

/** One widget interface; records the methods it has in `signaturesOf` for the widgets built on it. */
function emitInterface(
    context: EmitContext,
    signaturesOf: Map<string, Methods>,
    name: string,
    bases: string[],
    systemNames: string[],
): string {
    const { docs, renderer } = context;
    const inherited = mergeInheritedMethods(bases, signaturesOf);
    const all: Methods = new Map(inherited);
    let out = `interface ${name}${bases.length ? ` extends ${bases.join(", ")}` : ""} {\n`;
    const own = systemNames.flatMap((s) =>
        (docs.systemsByName.get(s)!.Functions ?? []).filter((fn) => !MANUAL_METHODS[s]?.includes(fn.Name)),
    );
    for (const fn of own.sort(byName)) {
        const signature = renderer.signature(fn);
        const baseSignatures = inherited.get(fn.Name) ?? [];
        if (baseSignatures.includes(signature)) continue;
        // A redeclared method keeps the base signatures as overloads so `extends` stays valid
        const signatures = [signature, ...baseSignatures];
        all.set(fn.Name, signatures);
        out += functionDoc("    ", fn) + signatures.map((s) => `    ${fn.Name}${s};\n`).join("");
    }
    signaturesOf.set(name, all);
    return out + "}\n\n";
}

export function emitWidgets(context: EmitContext): string {
    let out = context.header("Widget (ScriptObject) interfaces; methods are called with `:`.");
    // Signatures of every method a widget has, including inherited ones: widget -> method -> signatures
    const signaturesOf = new Map<string, Methods>();
    for (const [name, bases, systemNames] of WIDGETS) out += emitInterface(context, signaturesOf, name, bases, systemNames);
    for (const system of context.docs.standaloneObjects) {
        out += emitInterface(context, signaturesOf, system.Name.replace(/API$/, ""), [], [system.Name]);
    }
    return out;
}

export function emitUnresolved({ renderer, header }: EmitContext): string {
    let out =
        header("Type names the documentation references but never defines.") +
        "// Add proper definitions to PRIMITIVES in scripts/generate-types/knowledge.ts or to types/wow-manual.d.ts.\n\n";
    for (const [name, count] of [...renderer.unresolved].sort(([a], [b]) => a.localeCompare(b))) {
        out += `/** Undocumented type, referenced ${count} time(s). */\ntype ${name} = any;\n`;
    }
    return out;
}
