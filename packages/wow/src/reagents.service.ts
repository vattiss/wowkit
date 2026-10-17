// Reagents of the group buffs: whether a spell needs one, whether there is one in the bags, and
// which are running low. Whether a spell needs a reagent is read from its tooltip, so a client
// that dropped the reagent cost never nags about it.
import { OnEvent, contains } from "@wowkit/core";
import type { BagsService } from "./bags.service";
import type { Reagent, ReagentStock } from "./reagent.interface";
import { REAGENT_LOW, REAGENTS } from "./reagents.constants";
import type { SpellsService } from "./spells.service";

export class ReagentsService {
    private readonly reagentBySpell = new LuaMap<number, Reagent>();
    /** spell ID -> its tooltip names the reagent (tooltips are read once per spell). */
    private readonly tooltipNeedsReagent = new LuaMap<number, boolean>();

    constructor(
        private readonly bags: BagsService,
        private readonly spells: SpellsService,
    ) {
        for (const reagent of REAGENTS) for (const spellId of reagent.spells) this.reagentBySpell.set(spellId, reagent);
    }

    @OnEvent("spells.invalidated")
    forgetTooltips(): void {
        for (const [id] of this.tooltipNeedsReagent) this.tooltipNeedsReagent.delete(id);
    }

    /** Can the spell be cast as far as reagents go? */
    hasReagentFor(spellId: number): boolean {
        const reagent = this.findReagentFor(spellId);
        return reagent === undefined || this.getReagentCount(reagent) > 0;
    }

    /** The reagents the group buffs of a class use ("PRIEST"), in list order. */
    getReagentsOfClass(classToken: string | undefined): Reagent[] {
        return REAGENTS.filter((reagent) => reagent.classToken === classToken);
    }

    /**
     * Reagents of spells the player knows, with REAGENT_LOW or fewer in the bags. `isWanted` leaves out the reagents
     * the player does not want to hear about.
     */
    findLowReagents(isWanted: (reagent: Reagent) => boolean = () => true): ReagentStock[] {
        const low: ReagentStock[] = [];
        for (const reagent of REAGENTS) {
            if (!isWanted(reagent)) continue;
            const usedBy = reagent.spells.find((spellId) => this.spells.isLearned(spellId) && this.findReagentFor(spellId) !== undefined);
            const count = usedBy !== undefined ? this.getReagentCount(reagent) : REAGENT_LOW + 1;
            if (count <= REAGENT_LOW) low.push({ reagent, name: this.getReagentName(reagent), count });
        }
        return low;
    }

    /** The name of the item (the client's, else the English one). */
    getReagentName(reagent: Reagent): string {
        return this.bags.getItemName(reagent.itemId) ?? reagent.name;
    }

    private getReagentCount(reagent: Reagent): number {
        return this.bags.getItemCount(reagent.itemId);
    }

    private doesTooltipNameReagent(spellId: number, reagent: Reagent): boolean {
        if (this.tooltipNeedsReagent.has(spellId)) return this.tooltipNeedsReagent.get(spellId) === true;
        const texts = this.spells.getSpellTooltipTexts(this.spells.resolve(spellId) ?? spellId);
        // No tooltip: assume the classic cost
        if (texts === undefined) return true;
        const reagentName = string.lower(this.getReagentName(reagent));
        const isNeeded = texts.some((text) => contains(string.lower(text), reagentName));
        this.tooltipNeedsReagent.set(spellId, isNeeded);
        return isNeeded;
    }

    /** The reagent this spell costs on this client, if any. */
    private findReagentFor(spellId: number): Reagent | undefined {
        const reagent = this.reagentBySpell.get(spellId);
        return reagent && this.doesTooltipNameReagent(spellId, reagent) ? reagent : undefined;
    }
}
