// Turns what the WowkitCheck addon (addons/wowkit-check) saved in the game into packages/@wowkit/wow-data/data/ids.json:
// what the client said of the spell and item IDs written in wow-data (/wowkit check).
//   node scripts/generate-wow-data.ts [--game 1.60.1.70425] [file]
// The saved file is WTF/Account/<ACCOUNT>/SavedVariables/WowkitCheck.lua next to the game's Interface folder
// (WOW_ADDONS_DIR); give its path to read another one. Run /wowkit check and /reload in the game first.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import luaparse from "luaparse";
import { MANUAL_TYPES_DIR } from "./lib/paths.ts";

const DATA_DIR = `${MANUAL_TYPES_DIR.replace("wow-types", "wow-data")}/data`;
const IDS_FILE = `${DATA_DIR}/ids.json`;

type LuaValue = string | number | boolean | LuaTable | undefined;
interface LuaTable {
    [key: string]: LuaValue;
}

/** The value of a literal or a table constructor of the saved file, as a JavaScript value. */
function readValue(node: luaparse.Expression): LuaValue {
    switch (node.type) {
        case "StringLiteral":
            // luaparse leaves value null unless asked; the raw text is the quoted string
            return (node.value as string | null) ?? node.raw.slice(1, -1);
        case "NumericLiteral":
            return node.value;
        case "BooleanLiteral":
            return node.value;
        case "UnaryExpression":
            return node.operator === "-" ? -(readValue(node.argument) as number) : undefined;
        case "TableConstructorExpression": {
            const table: LuaTable = {};
            let index = 1;
            for (const field of node.fields) {
                if (field.type === "TableKey") table[String(readValue(field.key))] = readValue(field.value);
                else if (field.type === "TableKeyString") table[field.key.name] = readValue(field.value);
                else table[String(index++)] = readValue(field.value);
            }
            return table;
        }
        default:
            return undefined;
    }
}

function findSavedFile(): string | undefined {
    const addons = process.env.WOW_ADDONS_DIR;
    if (!addons) return undefined;
    const accounts = `${addons}/../../WTF/Account`;
    if (!existsSync(accounts)) return undefined;
    for (const account of readdirSync(accounts)) {
        const file = `${accounts}/${account}/SavedVariables/WowkitCheck.lua`;
        if (existsSync(file)) return file;
    }
    return undefined;
}

/** "Name|2" -> the name and the rank; a name alone has no rank. */
function splitAnswer(text: string): { name: string; rank: number | undefined } {
    const bar = text.lastIndexOf("|");
    if (bar < 0) return { name: text, rank: undefined };
    return { name: text.slice(0, bar), rank: Number(text.slice(bar + 1)) };
}

/** [id, "Name", rank?] for an ID the client knows, [id] for one it does not. */
function listAnswers(table: LuaTable | undefined, hasRank: boolean): (number | string)[][] {
    return Object.entries(table ?? {})
        .map(([id, text]) => {
            const { name, rank } = splitAnswer(String(text));
            if (name === "") return [Number(id)];
            return hasRank && rank !== undefined ? [Number(id), name, rank] : [Number(id), name];
        })
        .sort((a, b) => Number(a[0]) - Number(b[0]));
}

/** The spells that could be the real ID of an unknown one, a label a line: `"Paladin.BlessingSanctuary": [[id, "Name", rank?]]`. */
function listCandidates(table: LuaTable | undefined): string {
    return Object.entries(table ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, found]) => {
            const rows = Object.values((found as LuaTable | undefined) ?? {}).map((text) => {
                const [id, name, rank] = String(text).split("|");
                return rank === undefined ? [Number(id), name] : [Number(id), name, Number(rank)];
            });
            return `    ${JSON.stringify(label)}: ${JSON.stringify(rows)}`;
        })
        .join(",\n");
}

function writeIdsFile(savedFile: string, game: string): void {
    const chunk = luaparse.parse(readFileSync(savedFile, "utf8"), { luaVersion: "5.1" });
    const statement = chunk.body[0];
    if (statement?.type !== "AssignmentStatement" || statement.init[0] === undefined) {
        console.error(`${savedFile} does not look like a saved variable.`);
        process.exit(1);
    }
    const db = readValue(statement.init[0]) as { checked?: { spells?: LuaTable; items?: LuaTable }; candidates?: LuaTable } | undefined;
    const spells = listAnswers(db?.checked?.spells, true);
    if (spells.length === 0) {
        console.error("No check in the saved file: type /wowkit check in the game, then /reload.");
        process.exit(1);
    }
    const items = listAnswers(db?.checked?.items, false);
    const candidates = listCandidates(db?.candidates);
    // One ID a line, sorted, so a new check changes only the lines that differ
    const lines = (list: unknown[][]) => list.map((row) => `    ${JSON.stringify(row)}`).join(",\n");
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
        IDS_FILE,
        `{\n  "game": ${JSON.stringify(game)},\n  "spells": [\n${lines(spells)}\n  ],\n  "items": [\n${lines(items)}\n  ],\n  "candidates": ${candidates === "" ? "{}" : `{\n${candidates}\n  }`}\n}\n`,
    );
    console.log(`${spells.length} spell IDs and ${items.length} item IDs from ${savedFile} written to ${IDS_FILE}`);
    if (candidates !== "") console.log(`The spells found by the name of an unknown ID:\n${candidates}`);
}

const args = process.argv.slice(2);
const gameIndex = args.indexOf("--game");
const fileArg = args.find((arg, index) => !arg.startsWith("--") && index !== gameIndex + 1);
const savedFile = fileArg ?? findSavedFile();
if (savedFile === undefined || !existsSync(savedFile)) {
    console.error("Cannot find WowkitCheck.lua. Give its path, or set WOW_ADDONS_DIR; run /wowkit check and /reload in the game first.");
    process.exit(1);
}
writeIdsFile(savedFile, gameIndex >= 0 ? (args[gameIndex + 1] ?? "") : "");
