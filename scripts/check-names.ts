// Fails when a function name does not start with a verb, or a boolean does not read as a question.
//
//   functions:  getSpellName, findMissingBuffs, showNotice       (not: spellName, missingBuffs)
//   booleans:   isFound, hasArrived, shouldRecheckDrop           (not: found, arrived, recheck)
//
// Decorators (packages/framework/src/decorators.ts) are the exception: they are written in PascalCase and read as
// annotations (@OnEvent, @Every), so their names are not checked.
//
// What counts as a function: declarations, methods, and properties or variables holding a function.
// What counts as a boolean: anything whose type is exactly `boolean`. Fields that may also be
// undefined (a three-state value) are not questions and are left alone.
//
//   node scripts/check-names.ts
import { relative } from "node:path";
import ts from "typescript";
import { ROOT, listSourceFolders } from "./lib/paths.ts";
import { createAddonsProgram } from "./lib/program.ts";

/** Words a function name may start with. Add a verb here when a new one is needed. */
const VERBS = new Set(
    (
        "accept acquire add allow append apply are assert attach attempt bind block build call can cancel change check choose " +
        "clear collect compare compute confirm contains convert copy count create decide delete deny describe destroy detach " +
        "determine disable dispatch does draw drain emit enable ensure evaluate fail fill filter find fire flush force forget " +
        "format get grant handle has hide index init insert invalidate is listen load log look make map mark match measure note " +
        "observe off on open parse pick play prepend print probe push queue read rebuild record refresh register reject release " +
        "reload remember remove render replace report request reset resolve restore revoke run sample save say scan schedule " +
        "select set should show skip sort split start stop subscribe sync take toggle track trigger try unbind unlock unwrap " +
        "update use validate verify wait warn wipe wrap trim identify detect tick redraw list judge expect react write connect"
    ).split(" "),
);
const QUESTION_WORDS = ["is", "has", "can", "should", "does", "did", "was", "will", "are", "had", "show", "hide"];

const toPosix = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

function firstWord(name: string): string {
    return name.match(/^[a-z]+/)?.[0] ?? "";
}

function startsWithWord(name: string, words: Iterable<string>): boolean {
    const word = firstWord(name);
    const rest = name.slice(word.length);
    return [...words].includes(word) && (rest === "" || /^[A-Z0-9]/.test(rest));
}

const program = createAddonsProgram();
const SOURCE_FOLDERS = listSourceFolders();
const checker = program.getTypeChecker();

const problems: string[] = [];
const report = (source: ts.SourceFile, node: ts.Node, message: string) => {
    problems.push(`${toPosix(source.fileName)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}  ${message}`);
};

function isFunctionValue(node: ts.Node | undefined): boolean {
    return node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

/** Declarations, methods, and properties or variables holding a function. */
function isFunctionLike(node: ts.Node): boolean {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return true;
    if (ts.isVariableDeclaration(node)) return isFunctionValue(node.initializer);
    if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
        return (
            isFunctionValue((node as ts.PropertyDeclaration).initializer) || (node.type !== undefined && ts.isFunctionTypeNode(node.type))
        );
    }
    return false;
}

/** Something that can hold a value, with the name it is declared under. */
function isValueDeclaration(node: ts.Node): boolean {
    return (
        ts.isPropertySignature(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node) ||
        ts.isVariableDeclaration(node)
    );
}

function checkDeclaration(source: ts.SourceFile, node: ts.Node, name: ts.Identifier): void {
    const text = name.text;
    const isFunction = isFunctionLike(node);
    const isDecorator = toPosix(source.fileName) === "packages/framework/src/decorators.ts" && /^[A-Z]/.test(text);
    if (isFunction && !isDecorator && !startsWithWord(text, VERBS)) {
        report(source, name, `function "${text}" should start with a verb`);
    }
    const isBooleanDeclaration =
        isValueDeclaration(node) && !isFunction && checker.typeToString(checker.getTypeAtLocation(name)) === "boolean";
    if (isBooleanDeclaration && !startsWithWord(text, QUESTION_WORDS)) {
        report(source, name, `boolean "${text}" should read as a question (is..., has..., can..., should...)`);
    }
}

for (const source of program.getSourceFiles()) {
    if (!SOURCE_FOLDERS.some((folder) => toPosix(source.fileName).startsWith(folder))) continue;
    const visit = (node: ts.Node) => {
        const name = (node as { name?: ts.Node }).name;
        if (name && ts.isIdentifier(name)) checkDeclaration(source, node, name);
        ts.forEachChild(node, visit);
    };
    visit(source);
}

if (problems.length > 0) {
    console.error(`${problems.length} names break the naming rules:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}
console.log("ok: every function starts with a verb and every boolean reads as a question");
