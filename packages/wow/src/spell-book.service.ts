// The spellbook index: every learned spell by name, with all of its ranks (each rank is a
// separate spellbook entry).
//
// Performance rules learned on the Forever client: never walk the whole spellbook on
// SPELLS_CHANGED or quest turn-in (it froze the client); build the index a few skill lines per
// frame, and at most once every few seconds.
import { type EventBus, buildSpellBookKey, contains } from "@wowkit/core";
import { attempt, attemptMulti, getReadable } from "./safe";

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        /** A rebuild of the spellbook index finished. */
        "spellbook.built": [];
    }
}

/** The banks of the spell book, read when needed: the package must load without the game's API (in its tests). */
function listBanks(): Enum.SpellBookSpellBank[] {
    return [Enum.SpellBookSpellBank.Player, Enum.SpellBookSpellBank.Pet];
}
/** Rebuilds that are not forced wait this long after the previous one. */
const MIN_REBUILD_INTERVAL = 5;

/** Test spells and old versions the client also knows by the same name. */
export function isJunkSpellName(name: string | undefined): boolean {
    if (name === undefined) return true;
    const upper = string.upper(name);
    return contains(upper, "TEST") || contains(upper, "(OLD)") || contains(upper, "(PT)");
}

function readBookItem(slot: number, bank: Enum.SpellBookSpellBank): LuaMultiReturn<[name?: string, id?: number]> {
    const info = attempt(C_SpellBook.GetSpellBookItemInfo, slot, bank);
    if (info) {
        // The book also lists spells not learned yet: those are not known
        if (getReadable(info.itemType) === Enum.SpellBookItemType.FutureSpell) return $multi();
        return $multi(getReadable(info.name), getReadable(info.spellID));
    }
    const [didSucceed, name] = attemptMulti(() => C_SpellBook.GetSpellBookItemName(slot, bank));
    if (!didSucceed) return $multi();
    return $multi(getReadable(name), undefined);
}

interface Entries {
    /** First spellbook ID per name key. */
    byName: LuaMap<string, number>;
    /** Every learned rank per name key. */
    ranks: LuaMap<string, number[]>;
}

export class SpellBookService {
    private entries: Entries | undefined;
    private generation = 0;
    private isBuildRunning = false;
    private lastBuildAt = 0;

    constructor(private readonly bus: EventBus) {}

    isReady(): boolean {
        return this.entries !== undefined;
    }

    isBuilding(): boolean {
        return this.isBuildRunning;
    }

    /** The first spellbook ID of a spell name (undefined before the index is built). */
    findSpellIdByName(name: string): number | undefined {
        return this.entries?.byName.get(buildSpellBookKey(name));
    }

    /** Every learned rank of a spell name. */
    getRanksByName(name: string): number[] {
        return this.entries?.ranks.get(buildSpellBookKey(name)) ?? [];
    }

    /** Drops the index; a running build is abandoned. */
    invalidate(): void {
        this.generation += 1;
        this.entries = undefined;
        this.isBuildRunning = false;
    }

    /**
     * A spell was just learned: add it to the ranks of its name. The index is not rebuilt on
     * learning (a full book walk froze the client), so without this a new rank would only show
     * after a /reload.
     */
    noteLearned(id: number, name: string): void {
        if (!this.entries) return;
        const key = buildSpellBookKey(name);
        const ranks = this.entries.ranks.get(key) ?? [];
        this.entries.ranks.set(key, ranks);
        if (!ranks.includes(id)) ranks.push(id);
    }

    /** Rebuilds the index: all at once with `isImmediate`, otherwise a few skill lines per frame. */
    rebuild(isImmediate: boolean): void {
        if (this.isBuildRunning && !isImmediate) return;
        if (!isImmediate && this.entries && GetTime() - this.lastBuildAt < MIN_REBUILD_INTERVAL) return;
        this.generation += 1;
        const generation = this.generation;
        this.entries = undefined;
        this.isBuildRunning = true;
        this.lastBuildAt = GetTime();
        const entries: Entries = { byName: new LuaMap(), ranks: new LuaMap() };

        const readSlot = (slot: number) => {
            for (const bank of listBanks()) {
                const [name, id] = readBookItem(slot, bank);
                if (id !== undefined && name !== undefined && name !== "" && !isJunkSpellName(name)) {
                    const key = buildSpellBookKey(name);
                    const ranks = entries.ranks.get(key);
                    if (ranks) ranks.push(id);
                    else entries.ranks.set(key, [id]);
                    if (!entries.byName.has(key)) entries.byName.set(key, id);
                }
            }
        };

        const lineCount = attempt(C_SpellBook.GetNumSpellBookSkillLines) ?? 0;
        let line = 1;
        let legacySlot = 1;
        /** Reads a few skill lines; true while there are more. */
        const readLineBatch = (): boolean => {
            for (let budget = isImmediate ? 99 : 2; line <= lineCount && budget > 0; line++, budget--) {
                const info = attempt(C_SpellBook.GetSpellBookSkillLineInfo, line);
                if (info) {
                    const offset = tonumber(info.itemIndexOffset) ?? 0;
                    const count = tonumber(info.numSpellBookItems) ?? 0;
                    for (let slot = offset + 1; slot <= offset + count; slot++) readSlot(slot);
                }
            }
            return line <= lineCount;
        };
        /** No skill lines reported: reads the first 400 slots, a few at a time; true while there are more. */
        const readLegacyBatch = (): boolean => {
            for (let budget = isImmediate ? 400 : 40; legacySlot <= 400 && budget > 0; legacySlot++, budget--) readSlot(legacySlot);
            return legacySlot <= 400;
        };
        const readNextBatch = () => {
            if (generation !== this.generation) return;
            const hasMore = lineCount > 0 ? readLineBatch() : readLegacyBatch();
            if (hasMore) return C_Timer.After(0, readNextBatch);
            this.entries = entries;
            this.isBuildRunning = false;
            this.bus.emit("spellbook.built");
        };
        if (isImmediate) readNextBatch();
        else C_Timer.After(0, readNextBatch);
    }
}
