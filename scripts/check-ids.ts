// Fails when an ID written in @wowkit/wow-data is not known to the game. The answers are in packages/@wowkit/wow-data/data/ids.json,
// made from /wowkit check in the game (see addons/wowkit-check), so the check needs no game. An ID the check has not
// seen yet is only reported: run /wowkit check again after adding one (and node scripts/generate-wanted-ids.ts first).
//   node scripts/check-ids.ts
import { existsSync, readFileSync } from "node:fs";
import { listCodeIds } from "./lib/code-ids.ts";
import { ROOT } from "./lib/paths.ts";

const IDS_FILE = `${ROOT}packages/@wowkit/wow-data/data/ids.json`;
if (!existsSync(IDS_FILE)) {
    console.log("skipped: no packages/@wowkit/wow-data/data/ids.json yet (type /wowkit check in the game, then pnpm gen:data)");
    process.exit(0);
}

type Row = [id: number, name?: string, rank?: number];
const answers = JSON.parse(readFileSync(IDS_FILE, "utf8")) as {
    spells: Row[];
    items: Row[];
    /** Per label of an unknown spell ID, the spells the check found by the words of its name. */
    candidates?: { [label: string]: Row[] | undefined };
};
const known = (rows: Row[]) => new Map(rows.map((row) => [row[0], row[1] !== undefined] as const));
const knownSpells = known(answers.spells);
const knownItems = known(answers.items);

const { spells, items } = listCodeIds();
const unknown: string[] = [];
const unchecked: string[] = [];
for (const [kind, ids, answered] of [
    ["spell", spells, knownSpells],
    ["item", items, knownItems],
] as const) {
    for (const [label, id] of ids) {
        const isKnown = answered.get(id);
        if (isKnown === undefined) unchecked.push(`${kind} ${id} ${label}`);
        else if (!isKnown) unknown.push(`${kind} ${id} ${label}`);
    }
}

/** " -> candidates: 20911 Blessing of Sanctuary (rank 1)": what the check found by the name of the label, if anything. */
function describeCandidates(label: string): string {
    const found = answers.candidates?.[label] ?? [];
    if (found.length === 0) return "";
    const spells = found.map(([id, name, rank]) => `${id} ${name}${rank === undefined ? "" : ` (rank ${rank})`}`);
    return ` -> candidates: ${spells.join("; ")}`;
}

if (unchecked.length > 0)
    console.log(
        `${unchecked.length} IDs are not in ids.json yet: ${unchecked.slice(0, 5).join("; ")}${unchecked.length > 5 ? "; ..." : ""}`,
    );
if (unknown.length > 0) {
    console.error(`${unknown.length} IDs of the code are not known to the game:`);
    for (const line of unknown) console.error(`  ${line}${describeCandidates(line.split(" ")[2] ?? "")}`);
    process.exit(1);
}
console.log(`ok: the ${spells.length} spell and ${items.length} item IDs of the code are known to the game`);
