// Reagents of the group buffs: whether a spell needs one, whether there is one in the bags, and
// which are running low. Whether a spell needs a reagent is read from its tooltip, so a client
// that dropped the reagent cost never nags about it.
import { isLearned, resolve, spellsInvalidated } from "./api/spells";
import { REAGENT_LOW, REAGENTS, type Reagent } from "./data/reagents";
import { attempt, getReadable } from "./util/safe";
import { contains } from "./util/text";

export interface ReagentStock {
    reagent: Reagent;
    name: string;
    count: number;
}

const reagentBySpell = new LuaMap<number, Reagent>();
for (const reagent of REAGENTS) for (const spellId of reagent.spells) reagentBySpell.set(spellId, reagent);

/** spell ID -> its tooltip names the reagent (tooltips are read once per spell). */
const tooltipNeedsReagent = new LuaMap<number, boolean>();
spellsInvalidated.listen(() => {
    for (const [id] of tooltipNeedsReagent) tooltipNeedsReagent.delete(id);
});

function getReagentName(reagent: Reagent): string {
    return getReadable(attempt(C_Item.GetItemNameByID, reagent.itemId)) ?? reagent.name;
}

function doesTooltipNameReagent(spellId: number, reagent: Reagent): boolean {
    const cached = tooltipNeedsReagent.get(spellId);
    if (cached !== undefined) return cached;
    const data = attempt(C_TooltipInfo.GetSpellByID, resolve(spellId) ?? spellId);
    // No tooltip: assume the classic cost
    let isNeeded = data === undefined || type(data) !== "table";
    if (!isNeeded) {
        const wanted = string.lower(getReagentName(reagent));
        for (const line of data!.lines ?? []) {
            for (const text of [getReadable(line.leftText), getReadable(line.rightText)]) {
                if (text !== undefined && contains(string.lower(text), wanted)) isNeeded = true;
            }
        }
        tooltipNeedsReagent.set(spellId, isNeeded);
    }
    return isNeeded;
}

/** The reagent this spell costs on this client, if any. */
export function findReagentFor(spellId: number): Reagent | undefined {
    const reagent = reagentBySpell.get(spellId);
    return reagent && doesTooltipNameReagent(spellId, reagent) ? reagent : undefined;
}

export function getReagentCount(reagent: Reagent): number {
    return getReadable(attempt(C_Item.GetItemCount, reagent.itemId)) ?? 0;
}

/** Can the spell be cast as far as reagents go? */
export function hasReagentFor(spellId: number): boolean {
    const reagent = findReagentFor(spellId);
    return reagent === undefined || getReagentCount(reagent) > 0;
}

/** Reagents of spells the player knows, with REAGENT_LOW or fewer in the bags. */
export function findLowReagents(): ReagentStock[] {
    const low: ReagentStock[] = [];
    for (const reagent of REAGENTS) {
        const usedBy = reagent.spells.find((spellId) => isLearned(spellId) && findReagentFor(spellId) !== undefined);
        const count = usedBy !== undefined ? getReagentCount(reagent) : REAGENT_LOW + 1;
        if (count <= REAGENT_LOW) low.push({ reagent, name: getReagentName(reagent), count });
    }
    return low;
}
