// Reagents of the group buffs: whether a spell needs one, whether there is one in the bags, and
// which are running low. Whether a spell needs a reagent is read from its tooltip, so a client
// that dropped the reagent cost never nags about it.
import { known, resolve, spellsInvalidated } from "./api/spells";
import { REAGENT_LOW, REAGENTS, type Reagent } from "./data/reagents";
import { attempt, safe } from "./util/safe";
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

function reagentName(reagent: Reagent): string {
    return safe(attempt(C_Item.GetItemNameByID, reagent.itemId)) ?? reagent.name;
}

function tooltipNames(spellId: number, reagent: Reagent): boolean {
    const cached = tooltipNeedsReagent.get(spellId);
    if (cached !== undefined) return cached;
    const data = attempt(C_TooltipInfo.GetSpellByID, resolve(spellId) ?? spellId);
    // No tooltip: assume the classic cost
    let needs = data === undefined || type(data) !== "table";
    if (!needs) {
        const wanted = string.lower(reagentName(reagent));
        for (const line of data!.lines ?? []) {
            for (const text of [safe(line.leftText), safe(line.rightText)]) {
                if (text !== undefined && contains(string.lower(text), wanted)) needs = true;
            }
        }
        tooltipNeedsReagent.set(spellId, needs);
    }
    return needs;
}

/** The reagent this spell costs on this client, if any. */
export function reagentFor(spellId: number): Reagent | undefined {
    const reagent = reagentBySpell.get(spellId);
    return reagent && tooltipNames(spellId, reagent) ? reagent : undefined;
}

export function reagentCount(reagent: Reagent): number {
    return safe(attempt(C_Item.GetItemCount, reagent.itemId)) ?? 0;
}

/** Can the spell be cast as far as reagents go? */
export function hasReagentFor(spellId: number): boolean {
    const reagent = reagentFor(spellId);
    return reagent === undefined || reagentCount(reagent) > 0;
}

/** Reagents of spells the player knows, with REAGENT_LOW or fewer in the bags. */
export function lowReagents(): ReagentStock[] {
    const low: ReagentStock[] = [];
    for (const reagent of REAGENTS) {
        const usedBy = reagent.spells.find((spellId) => known(spellId) && reagentFor(spellId) !== undefined);
        const count = usedBy !== undefined ? reagentCount(reagent) : REAGENT_LOW + 1;
        if (count <= REAGENT_LOW) low.push({ reagent, name: reagentName(reagent), count });
    }
    return low;
}
