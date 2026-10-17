// Spell info and spell resolution.
//
// Forever remaps many spell IDs, so a spell of the buff lists is resolved to the ID the player
// knows: by ID, by override, and finally by name through the spellbook index.
import type { EventBus } from "@forever/framework";
import { OnEvent } from "@forever/framework";
import type { SpellBookService } from "./spell-book.service";
import { isJunkSpellName } from "./spell-book.service";
import { attempt, attemptMulti, getReadable, isReadable, tryCall } from "./safe";

/** English spellbook names for spell IDs the client does not name; the addon knows them, the toolkit asks for them. */
export interface SpellNameHints {
    [spellId: number]: string | undefined;
}

declare module "@forever/framework/event-bus" {
    interface AppEvents {
        /** Spell lookups were invalidated (new spells learned, talents changed). */
        "spells.invalidated": [];
        /** The spellbook index was rebuilt (one frame after "spellbook.built"). */
        "spellbook.indexed": [];
    }
}

export class SpellsService {
    /** spell ID -> the ID the player knows, or false when not known (cached until invalidated). */
    private readonly resolveCache = new LuaMap<number, number | false>();

    constructor(
        private readonly book: SpellBookService,
        private readonly bus: EventBus,
        private readonly hints: SpellNameHints,
    ) {}

    @OnEvent("spellbook.built")
    noteSpellBookBuilt(): void {
        this.invalidateSpells(false);
        // One frame later, so the index build and the next tick never share a frame
        C_Timer.After(0, () => this.bus.emit("spellbook.indexed"));
    }

    getSpellInfo(spellId: number | undefined): SpellInfo | undefined {
        if (spellId === undefined) return undefined;
        return attempt(C_Spell.GetSpellInfo, spellId);
    }

    getSpellName(spellId: number | undefined): string | undefined {
        const info = this.getSpellInfo(spellId);
        return info ? getReadable(info.name) : undefined;
    }

    /** Rebuilds the spellbook index (see SpellBookService.rebuild). */
    rebuildSpellBook(isImmediate: boolean): void {
        this.book.rebuild(isImmediate);
    }

    /** The ID of a spell given by name (a cast name, a poison name). */
    resolveFromName(name: string | undefined): number | undefined {
        if (name === undefined || name === "" || isJunkSpellName(name)) return undefined;
        return this.findPlayerSpellByName(name) ?? this.lookUpSpellId(name);
    }

    /** The English spellbook name of a spell, for IDs the client does not name. */
    getHintName(spellId: number | undefined): string | undefined {
        return spellId !== undefined ? this.hints[spellId] : undefined;
    }

    getSpellLabel(spellId: number): string | undefined {
        return this.getSpellName(spellId) ?? this.getHintName(spellId);
    }

    /**
     * Forgets cached lookups. `shouldDropSpellBook` also drops the spellbook index; otherwise only
     * failed lookups are forgotten, so a newly learned rank resolves.
     */
    invalidateSpells(shouldDropSpellBook: boolean): void {
        for (const [id, resolved] of this.resolveCache) {
            if (shouldDropSpellBook || resolved === false) this.resolveCache.delete(id);
        }
        if (shouldDropSpellBook) this.book.invalidate();
        this.bus.emit("spells.invalidated");
    }

    /** The spell ID the player knows for this spell (by ID, override, name and spellbook). */
    resolve(spellId: number | undefined): number | undefined {
        if (spellId === undefined) return undefined;
        const cached = this.resolveCache.get(spellId);
        if (cached !== undefined) return cached === false ? undefined : cached;
        const id = this.findKnownId(spellId);
        this.resolveCache.set(spellId, id ?? false);
        return id;
    }

    isLearned(spellId: number | undefined): boolean {
        return this.resolve(spellId) !== undefined;
    }

    /**
     * Can the spell be cast right now (power, form, ...)? Undefined when the client gives no readable
     * answer. Battle Shout with 0 rage: false.
     */
    isCastable(spellId: number): boolean | undefined {
        const [didSucceed, isUsable] = attemptMulti(() => C_Spell.IsSpellUsable(spellId));
        if (!didSucceed || !isReadable(isUsable)) return undefined;
        return isUsable === true;
    }

    /** The texts of the spell's tooltip; undefined when the client has none. */
    getSpellTooltipTexts(spellId: number): string[] | undefined {
        const tooltip = attempt(C_TooltipInfo.GetSpellByID, spellId);
        if (tooltip === undefined || type(tooltip) !== "table") return undefined;
        const texts: string[] = [];
        for (const line of tooltip.lines ?? []) {
            for (const text of [getReadable(line.leftText), getReadable(line.rightText)]) {
                if (text !== undefined) texts.push(text);
            }
        }
        return texts;
    }

    /** The rank number from the spell's subtext ("Rank 2"); undefined without a rank or text. */
    getSpellRank(spellId: number): number | undefined {
        const text = getReadable(attempt(C_Spell.GetSpellSubtext, spellId));
        if (text === undefined) return undefined;
        const [digits] = string.match(text, "(%d+)");
        return digits !== undefined ? tonumber(digits) : undefined;
    }

    /** A spell was just learned (LEARNED_SPELL_IN_SKILL_LINE): add it to the ranks of its name. */
    noteLearnedSpell(spellId: number | undefined): void {
        const id = getReadable(spellId);
        const name = this.getSpellName(id);
        if (id !== undefined && name !== undefined && name !== "") this.book.noteLearned(id, name);
    }

    /** The highest learned rank of a spell (by name, from the spellbook index). */
    getHighestRank(spellId: number): number | undefined {
        const name = this.getSpellName(spellId);
        if (name === undefined || name === "") return undefined;
        let best: number | undefined;
        for (const id of this.book.getRanksByName(name)) {
            const rank = this.getSpellRank(id);
            if (rank !== undefined && (best === undefined || rank > best)) best = rank;
        }
        return best;
    }

    /** The ID the client gives a spell name; also for spells the player has not learned. */
    private lookUpSpellId(name: string): number | undefined {
        if (isJunkSpellName(name)) return undefined;
        const info = attempt(C_Spell.GetSpellInfo, name);
        if (!info) return undefined;
        const id = getReadable(info.spellID);
        const got = getReadable(info.name);
        if (id !== undefined && (got === undefined || got === name) && !isJunkSpellName(got ?? name)) return id;
        return undefined;
    }

    /** Learned, or in the spellbook (with overrides). */
    private isKnownToPlayer(id: number): boolean {
        return attempt(C_SpellBook.IsSpellKnown, id) === true || attempt(C_SpellBook.IsSpellInSpellBook, id) === true;
    }

    private findPlayerSpellByName(name: string): number | undefined {
        if (this.book.isReady()) return this.book.findSpellIdByName(name);
        // Before the index exists: the cheap name lookup, which also answers for spells not learned
        // yet, so ask whether it is known. Then warm the index in the background.
        const fromApi = this.lookUpSpellId(name);
        if (fromApi !== undefined && this.isKnownToPlayer(fromApi)) return fromApi;
        if (!this.book.isBuilding()) this.book.rebuild(false);
        return undefined;
    }

    /** The spell the client currently shows in place of this one (a form, a talent); the same ID when none. */
    private findOverride(spellId: number): number {
        const [didSucceed, override] = tryCall(C_Spell.GetOverrideSpell, spellId);
        return didSucceed && isReadable(override) && type(override) === "number" ? override! : spellId;
    }

    /** The names a spell goes by, without repeats: the client's name first, then the English hints. */
    private listSpellNames(spellId: number, overrideId: number): string[] {
        const names: string[] = [];
        for (const name of [
            this.getSpellName(overrideId) ?? this.getSpellName(spellId),
            this.getHintName(spellId),
            this.getHintName(overrideId),
        ]) {
            if (name !== undefined && name !== "" && !names.includes(name)) names.push(name);
        }
        return names;
    }

    /** The ID of a known spell with one of these names: by the name table, then by the spellbook. */
    private findKnownIdByNames(names: string[]): number | undefined {
        for (const name of names) {
            const fromName = this.lookUpSpellId(name);
            if (fromName !== undefined && this.isKnownToPlayer(fromName)) return fromName;
            const bookId = this.findPlayerSpellByName(name);
            if (bookId !== undefined) return bookId;
        }
        return undefined;
    }

    private findKnownId(spellId: number): number | undefined {
        const id = this.findOverride(spellId);
        if (this.isKnownToPlayer(id)) return id;
        if (id !== spellId && this.isKnownToPlayer(spellId)) return spellId;
        return this.findKnownIdByNames(this.listSpellNames(spellId, id));
    }
}
