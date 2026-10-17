// Generates TypeScript declarations (types/generated/*.d.ts) from Blizzard's API documentation
// (Interface/AddOns/Blizzard_APIDocumentationGenerated in Gethe/wow-ui-source, "forever" branch).
// Run "pnpm fetch:wow-ui" first, then "pnpm gen:types".
//
//   generate-types/documentation.ts   reads and sorts the documentation tables
//   generate-types/knowledge.ts       what the documentation lacks or gets wrong
//   generate-types/type-renderer.ts   documentation types as TypeScript text
//   generate-types/emitters.ts        one emitter for each generated file
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { GENERATED_TYPES_DIR } from "./lib/paths.ts";
import { loadDocumentation } from "./generate-types/documentation.ts";
import { createHeader, emitApi, emitEnums, emitEvents, emitStructures, emitUnresolved, emitWidgets } from "./generate-types/emitters.ts";
import { WIDGETS } from "./generate-types/knowledge.ts";
import { TypeRenderer } from "./generate-types/type-renderer.ts";

const docs = loadDocumentation();
const renderer = new TypeRenderer(docs);
const context = { docs, renderer, header: createHeader() };

// Order matters: emitters register the unresolved names they meet, so emitUnresolved runs last
const files: [string, string][] = [
    ["wow-api.d.ts", emitApi(context)],
    ["wow-enums.d.ts", emitEnums(context)],
    ["wow-structures.d.ts", emitStructures(context)],
    ["wow-events.d.ts", emitEvents(context)],
    ["wow-widgets.d.ts", emitWidgets(context)],
];
files.push(["wow-unresolved.d.ts", emitUnresolved(context)]);

rmSync(GENERATED_TYPES_DIR, { recursive: true, force: true });
mkdirSync(GENERATED_TYPES_DIR, { recursive: true });
for (const [file, content] of files) writeFileSync(`${GENERATED_TYPES_DIR}/${file}`, content);

console.log(
    `Generated ${files.length} files from ${docs.systems.length} documentation tables: ` +
        `${docs.enums.size} enums, ${docs.structures.size} structures, ${docs.events.size} events, ` +
        `${WIDGETS.length + docs.standaloneObjects.length} widget types, ${renderer.unresolved.size} unresolved type names.`,
);
if (docs.duplicates.length) console.log(`Skipped duplicate definitions: ${docs.duplicates.join(", ")}`);
