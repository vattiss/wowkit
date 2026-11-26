// Reagents of the group buffs: whether a spell needs one, whether there is one in the bags, and
// which are running low. Whether a spell needs a reagent is read from its tooltip, so a client
// that dropped the reagent cost never nags about it.
import { OnEvent } from "@wowkit/core";
import { type BagsService, type SpellsService, isSameName, doesTextName } from "@wowkit/wow";
import type { BelowLimitsService } from "../reminders/below-limits.service";
import type { Reagent, ReagentStock } from "./reagent.interface";
import { REAGENTS } from "./reagents.constants";

/** What the limit of a reagent spell's row is kept under: its list ID, or the ID of a spell the player added. */
export function findReagentRowEntry(spellId: number): string {
    return `spell${string.format("%d", spellId)}`;
}

export class ReagentsService {
    private readonly reagentBySpell = new LuaMap<number, Reagent>();
    /** spell ID -> its tooltip names the reagent (tooltips are read once per spell). */
    private readonly tooltipNeedsReagent = new LuaMap<number, boolean>();

    constructor(
        private readonly bags: BagsService,
        private readonly spells: SpellsService,
        private readonly limits: BelowLimitsService,
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

    /** The first item of the "Reagents:" line of the spell's tooltip (the English client's wording); undefined without one. */
    findTooltipReagent(spellId: number): string | undefined {
        const list = this.spells.readTooltipReagents(spellId);
        if (list === undefined) return undefined;
        // Color codes, line breaks and counts are not part of the name: "|cffff2020Holy Candle|r (2)", " |nRune of Teleportation"
        const [noColor] = string.gsub(string.gsub(list, "|c%x%x%x%x%x%x%x%x", "")[0], "|r", "");
        const [plain] = string.gsub(noColor, "|n", " ");
        const [first] = string.match(plain, "^%s*([^,%(]-)%s*[,%(]");
        return first ?? string.match(plain, "^%s*(.-)%s*$")[0];
    }

    /** The reagents the group buffs of a class use ("PRIEST"), in list order. */
    getReagentsOfClass(classToken: string | undefined): Reagent[] {
        return REAGENTS.filter((reagent) => reagent.classToken === classToken);
    }

    /**
     * The row of a group buff of the list: the first ID of its name among the reagent's spells (its ranks share a row). Its
     * switch and its limit go by it.
     */
    findListId(reagent: Reagent, spellId: number): number {
        const name = this.spells.getSpellName(spellId);
        return reagent.spells.find((id) => id === spellId || isSameName(this.spells.getSpellName(id), name)) ?? spellId;
    }

    /** The rows of a reagent's spells (their list IDs), each once, in list order. */
    listRowIds(reagent: Reagent): number[] {
        const ids: number[] = [];
        for (const spellId of reagent.spells) {
            const listId = this.findListId(reagent, spellId);
            if (!ids.includes(listId)) ids.push(listId);
        }
        return ids;
    }

    /**
     * Reagents of spells the player knows, running low by the limit of such a spell's row, each once. `isWanted` leaves out
     * the rows (list IDs) the player switched off. A rank the player has outgrown does not count (Prayer of Fortitude 1, with
     * rank 2 learned: no Holy Candle needed).
     */
    findLowReagents(isWanted: (listId: number) => boolean = () => true): ReagentStock[] {
        const low: ReagentStock[] = [];
        for (let index = 0; index < REAGENTS.length; index++) {
            const reagent = REAGENTS[index]!;
            const count = this.getReagentCount(reagent);
            const usedBy = reagent.spells.find((spellId) => this.isLowFor(reagent, index, spellId, count, isWanted));
            if (usedBy !== undefined) low.push({ reagent, spellId: usedBy, name: this.getReagentName(reagent), count });
        }
        return low;
    }

    /** The learned group buffs, as the IDs the buttons hold, whose reagent runs low by the limit of their own row. */
    findSpellsWithLowReagent(isWanted: (listId: number) => boolean = () => true): number[] {
        const spellIds: number[] = [];
        for (let index = 0; index < REAGENTS.length; index++) {
            const reagent = REAGENTS[index]!;
            const count = this.getReagentCount(reagent);
            for (const spellId of reagent.spells) {
                const learned = this.spells.resolve(spellId);
                if (learned !== undefined && !spellIds.includes(learned) && this.isLowFor(reagent, index, spellId, count, isWanted))
                    spellIds.push(learned);
            }
        }
        return spellIds;
    }

    /** This many of a reagent in the bags is running low: fewer than the limit of its row (`entry`), else the reminderType's. */
    isLow(count: number, entry?: string): boolean {
        return count < this.limits.getLimit("lowReagent", entry);
    }

    /**
     * Does this spell want its reagent and run low of it: learned, costing it on this client, not outgrown, its row switched
     * on, and fewer in the bags than the limit of its row?
     */
    private isLowFor(reagent: Reagent, index: number, spellId: number, count: number, isWanted: (listId: number) => boolean): boolean {
        if (!this.spells.isLearned(spellId) || this.findReagentFor(spellId) === undefined || this.isOutranked(spellId, index)) return false;
        const listId = this.findListId(reagent, spellId);
        return isWanted(listId) && this.isLow(count, findReagentRowEntry(listId));
    }

    /** Does the player know a higher rank of the spell, one with a later reagent of the list (its ranks are in order)? */
    private isOutranked(spellId: number, index: number): boolean {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined) return false;
        return REAGENTS.slice(index + 1).some((later) =>
            later.spells.some((id) => this.spells.isLearned(id) && isSameName(this.spells.getSpellName(id), name)),
        );
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
        const reagentName = this.getReagentName(reagent);
        const isNeeded = texts.some((text) => doesTextName(text, reagentName));
        // Before the client has loaded the item's name, the English one proves nothing on another client: it is looked at again
        if (this.bags.getItemName(reagent.itemId) !== undefined) this.tooltipNeedsReagent.set(spellId, isNeeded);
        return isNeeded;
    }

    /** The reagent this spell costs on this client, if any. */
    private findReagentFor(spellId: number): Reagent | undefined {
        const reagent = this.reagentBySpell.get(spellId);
        return reagent && this.doesTooltipNameReagent(spellId, reagent) ? reagent : undefined;
    }
}
