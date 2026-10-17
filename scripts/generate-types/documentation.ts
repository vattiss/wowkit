// Reads Blizzard's documentation tables and sorts them: enums, structures, callbacks, constants,
// events, and the widget classes with the names the documentation uses for them.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { DOCS_DIR, MANUAL_TYPES_DIR } from "../lib/paths.ts";
import { parseDocumentationFile } from "../lib/lua-table.ts";
import type { DocEvent, DocSystem, DocTable } from "./documentation-shapes.ts";
import { WIDGET_ALIASES, WIDGETS } from "./knowledge.ts";

export interface Documentation {
    systems: DocSystem[];
    enums: Map<string, DocTable>;
    structures: Map<string, DocTable>;
    callbacks: Map<string, DocTable>;
    constants: Map<string, DocTable>;
    events: Map<string, DocEvent>;
    /** Definitions that appeared twice; the first one wins. */
    duplicates: string[];
    /** The ScriptObject systems by their documentation name. */
    systemsByName: Map<string, DocSystem>;
    widgetNames: Set<string>;
    /** Names the documentation uses for a widget -> the widget's own name. */
    widgetAliases: Map<string, string>;
    /** ScriptObjects outside the widget hierarchy (formatters, clocks, ...). */
    standaloneObjects: DocSystem[];
    /** Types declared by hand in types/*.d.ts; they count as resolved. */
    manualTypes: Set<string>;
}

function readSystems(): DocSystem[] {
    if (!existsSync(DOCS_DIR)) {
        console.error(`Missing ${DOCS_DIR}\nRun "pnpm fetch:wow-ui" first.`);
        process.exit(1);
    }
    const systems: DocSystem[] = [];
    for (const file of readdirSync(DOCS_DIR)
        .filter((f) => f.endsWith(".lua"))
        .sort()) {
        try {
            systems.push(parseDocumentationFile(readFileSync(`${DOCS_DIR}/${file}`, "utf8")) as unknown as DocSystem);
        } catch (error) {
            throw new Error(`${file}: ${(error as Error).message}`, { cause: error });
        }
    }
    return systems;
}

function readManualTypes(): Set<string> {
    return new Set(
        readdirSync(MANUAL_TYPES_DIR)
            .filter((f) => f.endsWith(".d.ts"))
            .flatMap((f) => [...readFileSync(`${MANUAL_TYPES_DIR}/${f}`, "utf8").matchAll(/^(?:declare )?(?:type|interface) (\w+)/gm)])
            .map((m) => m[1]!),
    );
}

/** Sorts the tables and events of every system into the maps of `docs`. */
function sortTablesAndEvents(docs: Documentation): void {
    const register = (map: Map<string, DocTable>, table: DocTable) => {
        if (map.has(table.Name)) docs.duplicates.push(`${table.Type} ${table.Name}`);
        else map.set(table.Name, table);
    };
    for (const system of docs.systems) {
        for (const table of system.Tables ?? []) {
            if (table.Type === "Enumeration") register(docs.enums, table);
            else if (table.Type === "Structure") register(docs.structures, table);
            else if (table.Type === "CallbackType") register(docs.callbacks, table);
            else if (table.Type === "Constants") register(docs.constants, table);
            // Precondition / Secret tables describe engine-side checks and have no Lua surface
        }
        for (const event of system.Events ?? []) {
            if (docs.events.has(event.LiteralName)) docs.duplicates.push(`Event ${event.LiteralName}`);
            else docs.events.set(event.LiteralName, event);
        }
    }
}

/** Finds the widget classes: the listed hierarchy, the standalone objects, and the aliases. */
function mapWidgets(docs: Documentation): void {
    for (const [name, , systemNames] of WIDGETS) {
        docs.widgetNames.add(name);
        docs.widgetAliases.set(systemNames[0]!.replace(/API$/, ""), name);
        for (const systemName of systemNames) {
            if (!docs.systemsByName.has(systemName)) throw new Error(`Widget ${name}: unknown ScriptObject system ${systemName}`);
        }
    }
    const mappedSystems = new Set(WIDGETS.flatMap(([, , systemNames]) => systemNames));
    docs.standaloneObjects.push(...[...docs.systemsByName.values()].filter((s) => !mappedSystems.has(s.Name)));
    for (const system of docs.standaloneObjects) {
        const name = system.Name.replace(/API$/, "");
        docs.widgetNames.add(name);
        docs.widgetAliases.set(name, name);
    }
    for (const [alias, name] of Object.entries(WIDGET_ALIASES)) docs.widgetAliases.set(alias, name);
}

export function loadDocumentation(): Documentation {
    const systems = readSystems();
    const docs: Documentation = {
        systems,
        enums: new Map(),
        structures: new Map(),
        callbacks: new Map(),
        constants: new Map(),
        events: new Map(),
        duplicates: [],
        systemsByName: new Map(systems.filter((s) => s.Type === "ScriptObject").map((s) => [s.Name, s])),
        widgetNames: new Set(),
        widgetAliases: new Map(),
        standaloneObjects: [],
        manualTypes: readManualTypes(),
    };
    sortTablesAndEvents(docs);
    mapWidgets(docs);
    return docs;
}
