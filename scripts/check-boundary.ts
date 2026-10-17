// Fails when code outside the game-facing folders touches the Blizzard API.
//
// The addon talks to the game in four places only: packages/wow/ (what the reminders ask the game),
// packages/framework/ (game events and timers, for the decorators and the lifecycle), the addon's options/ (the
// Settings panel) and diagnostics/ (the debug mode, which probes what the game answers).
// Everything else speaks in the addon's own terms, so it reads like plain code and never has to
// know about secret values, protected calls or remapped IDs.
//
// A thing belongs to Blizzard when its declaration is in packages/wow-types/ (generated from Blizzard's API
// documentation, or the hand-written FrameXML typings). Using such a type in a type position is
// fine; using such a value (a function, a constant, a method, a field) is not.
//
//   node scripts/check-boundary.ts
import { relative } from "node:path";
import ts from "typescript";
import { ROOT, listSourceFolders } from "./lib/paths.ts";
import { createAddonsProgram } from "./lib/program.ts";

/** Where code may call the game: the game-facing packages, and the options and diagnostics folders of every addon. */
const ALLOWED_FOLDERS = [
    "packages/wow/src/",
    "packages/framework/src/",
    "packages/ui/src/",
    "addons/*/src/options/",
    "addons/*/src/diagnostics/",
];
const isAllowed = (file: string) => ALLOWED_FOLDERS.some((folder) => new RegExp(`^${folder.replace("*", "[^/]+")}`).test(file));
const SOURCE_FOLDERS = listSourceFolders();
const isSource = (file: string) => SOURCE_FOLDERS.some((folder) => file.startsWith(folder));
/** Lua standard functions that are fine in general but would hide errors or bypass the wow/ layer. */
const FORBIDDEN_LUA_NAMES = new Set(["pcall", "xpcall", "print", "_G"]);

const toPosix = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

const program = createAddonsProgram();
const checker = program.getTypeChecker();

function isBlizzardValue(symbol: ts.Symbol | undefined): boolean {
    if (!symbol || !(symbol.flags & ts.SymbolFlags.Value)) return false;
    // A namespace both Lua and Blizzard declare (string, math, table) is Lua's; its Blizzard-only members are checked on their own
    const declarations = symbol.declarations ?? [];
    return (
        declarations.length > 0 &&
        declarations.every((declaration) => toPosix(declaration.getSourceFile().fileName).startsWith("packages/wow-types/"))
    );
}

interface Violation {
    file: string;
    line: number;
    name: string;
}

const violations: Violation[] = [];
for (const source of program.getSourceFiles()) {
    const file = toPosix(source.fileName);
    if (!isSource(file) || isAllowed(file)) continue;
    const visit = (node: ts.Node) => {
        const isInTypeOrImport = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node);
        if (isInTypeOrImport) return;
        if (ts.isIdentifier(node)) {
            let symbol = checker.getSymbolAtLocation(node);
            if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
            if (isBlizzardValue(symbol) || FORBIDDEN_LUA_NAMES.has(node.text)) {
                violations.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, name: node.text });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}

const checkedFiles = program.getSourceFiles().filter((f) => isSource(toPosix(f.fileName)) && !isAllowed(toPosix(f.fileName)));
if (violations.length > 0) {
    console.error(`${violations.length} uses of the Blizzard API outside ${ALLOWED_FOLDERS.join(", ")}:`);
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.name}`);
    process.exit(1);
}
console.log(`ok: the ${checkedFiles.length} files outside ${ALLOWED_FOLDERS.join(", ")} do not touch the Blizzard API`);
