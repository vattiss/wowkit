// Fails when code outside src/wow/ and src/ui/ touches the Blizzard API.
//
// The addon talks to the game in two places only: src/wow/ (what the reminders ask the game) and
// src/ui/ (the options page and the debug report, which need the Settings panel API). Everything
// else speaks in the addon's own terms, so it reads like plain code and never has to know about
// secret values, protected calls or remapped IDs.
//
// A thing belongs to Blizzard when its declaration is in types/ (generated from Blizzard's API
// documentation, or the hand-written FrameXML typings). Using such a type in a type position is
// fine; using such a value (a function, a constant, a method, a field) is not.
//
//   node scripts/check-boundary.ts
import { relative } from "node:path";
import ts from "typescript";
import { ROOT } from "./lib/paths.ts";

const ALLOWED_FOLDERS = ["src/wow/", "src/ui/"];
/** Lua standard functions that are fine in general but would hide errors or bypass the wow/ layer. */
const FORBIDDEN_LUA_NAMES = new Set(["pcall", "xpcall", "print", "_G"]);

const toPosix = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

const configFile = ts.getParsedCommandLineOfConfigFile(`${ROOT}tsconfig.json`, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
if (!configFile) throw new Error("tsconfig.json not found");
const program = ts.createProgram(configFile.fileNames, configFile.options);
const checker = program.getTypeChecker();

function isBlizzardValue(symbol: ts.Symbol | undefined): boolean {
    if (!symbol || !(symbol.flags & ts.SymbolFlags.Value)) return false;
    // A namespace both Lua and Blizzard declare (string, math, table) is Lua's; its Blizzard-only members are checked on their own
    const declarations = symbol.declarations ?? [];
    return declarations.length > 0 && declarations.every((declaration) => toPosix(declaration.getSourceFile().fileName).startsWith("types/"));
}

interface Violation {
    file: string;
    line: number;
    name: string;
}

const violations: Violation[] = [];
for (const source of program.getSourceFiles()) {
    const file = toPosix(source.fileName);
    if (!file.startsWith("src/") || ALLOWED_FOLDERS.some((folder) => file.startsWith(folder))) continue;
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

const checkedFiles = program.getSourceFiles().filter((f) => toPosix(f.fileName).startsWith("src/") && !ALLOWED_FOLDERS.some((folder) => toPosix(f.fileName).startsWith(folder)));
if (violations.length > 0) {
    console.error(`${violations.length} uses of the Blizzard API outside src/wow/ and src/ui/:`);
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.name}`);
    process.exit(1);
}
console.log(`ok: the ${checkedFiles.length} files outside src/wow/ and src/ui/ do not touch the Blizzard API`);
