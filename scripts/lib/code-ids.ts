// The spell and item IDs written in @wowkit/wow-data, with the name each has there ("Paladin.BlessingMight"): what the
// check asks the game about. The data files hold only literals and import nothing, so Node loads them as they are.
import { ITEMS } from "../../packages/@wowkit/wow-data/src/items.ts";
import { SPELLS } from "../../packages/@wowkit/wow-data/src/spells.ts";

export interface CodeIds {
    spells: [label: string, id: number][];
    items: [label: string, id: number][];
}

interface Tables {
    [category: string]: { [key: string]: number | number[] };
}

function listIds(tables: Tables): [string, number][] {
    const ids: [string, number][] = [];
    for (const [category, entries] of Object.entries(tables)) {
        for (const [key, value] of Object.entries(entries)) {
            if (typeof value === "number") ids.push([`${category}.${key}`, value]);
            else value.forEach((id, index) => ids.push([`${category}.${key}[${index}]`, id]));
        }
    }
    return ids;
}

export function listCodeIds(): CodeIds {
    return { spells: listIds(SPELLS), items: listIds(ITEMS) };
}
