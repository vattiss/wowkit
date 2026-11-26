// Remembers the buffs on the player while the client hides them. In combat the client may return no
// auras at all, or auras whose name and ID are secret, so a buff seen or cast a moment ago counts
// as up until its usual duration runs out.

import { type AuraEntry, type ClockService, type SpellsService, hasKnownExpiry, buildNameKey } from "@wowkit/wow";
import type { BuffKnowledgeService } from "../knowledge/buff-knowledge.service";
import type { BuffMemorySnapshot } from "./buff-memory.snapshot";

/** A shapeshift form (Cat Form, Travel Form...): no end, only changes with a shapeshift. */
const FORM_SECONDS = 1800;
/** After a cast, a missing aura is not believed for this long (it may not have arrived yet). */
const CAST_SETTLE = 1;
/** After a shapeshift, the form cast this recently is the new one. */
const FORM_CAST_SETTLE = 1.5;
/** A buff cast with no known length is held this long: a guess (see `guessed`). */
const GUESS_SECONDS = 30;

export class BuffMemoryService {
    /** Aura key -> the clock time when the memory runs out. */
    private readonly heldNames = new LuaMap<string, number>();
    /** Category key -> the clock time when the memory runs out. */
    private readonly heldCategories = new LuaMap<string, number>();
    /** Aura or category key -> the clock time of the player's cast. */
    private readonly castAt = new LuaMap<string, number>();
    /** The buffs (aura keys) cast with no known length: held for a guess, their end is not known. */
    private readonly guessed = new LuaSet<string>();
    /** The buffs (aura keys) renewed in a way that does not show their new end (a food eaten where Well Fed is kept secret). */
    private readonly unsure = new LuaSet<string>();
    /** The buffs (aura keys) anything is known of: seen, cast, seen gone, or lost with a death. */
    private readonly recorded = new LuaSet<string>();
    /** The name of each buff remembered (by aura key). */
    private readonly names = new LuaMap<string, string>();
    /** How long a buff lasts as learned from its aura (by aura key); none until told (see useLearnedDurations). */
    private findLearned: (this: void, key: string) => number | undefined = () => undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly clock: ClockService,
        private readonly knowledge: BuffKnowledgeService,
    ) {}

    /** Where to look up how long a buff lasts, as learned from its aura. */
    useLearnedDurations(find: (this: void, key: string) => number | undefined): void {
        this.findLearned = find;
    }

    isEmpty(): boolean {
        return this.heldNames.isEmpty() && this.heldCategories.isEmpty();
    }

    /**
     * The buff was seen (with `remain` seconds left; undefined when unknown) or cast. A sighting
     * renews the memory: an aspect seen every few seconds never runs out.
     */
    remember(spellId: number | undefined, auraName: string | undefined, remain: number | undefined, isFromCast: boolean): void {
        const name = auraName ?? (spellId !== undefined ? this.spells.getSpellLabel(spellId) : undefined);
        if (name === undefined || name === "") return;
        const key = buildNameKey(name);
        const category = this.knowledge.findCategory(name, spellId);
        const known = this.findKnownSeconds(key, spellId, name, category?.seconds);
        const now = this.clock.getCurrentTime();
        const expires = this.findExpiry(key, now, known ?? GUESS_SECONDS, remain, isFromCast);
        if (expires !== undefined) {
            this.heldNames.set(key, expires);
            if (category) this.heldCategories.set(category.key, expires);
        }
        this.noteKnown(key, name, isFromCast && known === undefined);
        if (isFromCast) {
            this.castAt.set(key, now);
            if (category) this.castAt.set(category.key, now);
        }
    }

    /** Is the buff (or a member of its category) remembered as up, with more than `lead` seconds left? */
    isRemembered(spellId: number, lead = 0): boolean {
        const name = this.spells.getSpellLabel(spellId);
        if (name === undefined || name === "") return false;
        const now = this.clock.getCurrentTime() + lead;
        if (now < (this.heldNames.get(buildNameKey(name)) ?? 0)) return true;
        const category = this.knowledge.findCategory(name, spellId);
        return category !== undefined && now < (this.heldCategories.get(category.key) ?? 0);
    }

    /** The buff was looked for and is gone. `categoriesSeen`: categories still up in the same scan. */
    release(spellId: number, categoriesSeen: LuaMap<string, AuraEntry> | undefined): void {
        const name = this.spells.getSpellLabel(spellId);
        if (name === undefined || name === "") return;
        const key = buildNameKey(name);
        const now = this.clock.getCurrentTime();
        if (now - (this.castAt.get(key) ?? -10) < CAST_SETTLE) return;
        this.heldNames.delete(key);
        this.unsure.delete(key);
        this.recorded.add(key);
        this.guessed.delete(key);
        const category = this.knowledge.findCategory(name, spellId);
        if (category && !categoriesSeen?.has(category.key) && now - (this.castAt.get(category.key) ?? -10) >= CAST_SETTLE) {
            this.heldCategories.delete(category.key);
        }
    }

    /** The buff ended before its time, as the game showed (its charges used up): it is not remembered any more. */
    forget(spellId: number): void {
        const name = this.spells.getSpellLabel(spellId);
        if (name === undefined || name === "") return;
        this.heldNames.delete(buildNameKey(name));
        this.castAt.delete(buildNameKey(name));
    }

    /**
     * A shapeshift happened: the remembered form is out of date (in combat the aura cannot be read
     * again). A form cast a moment ago is the new one and is kept.
     */
    forgetForms(): void {
        const now = this.clock.getCurrentTime();
        for (const [key] of this.heldNames) {
            if (this.knowledge.isFormKey(key) && now - (this.castAt.get(key) ?? -10) >= FORM_CAST_SETTLE) this.heldNames.delete(key);
        }
    }

    /** Was the buff cast with no known length, so its end is only guessed? */
    isLengthUnknown(spellId: number): boolean {
        const key = this.findKey(spellId);
        return key !== undefined && this.guessed.has(key);
    }

    /** Is the buff's end not known: cast with no known length, or renewed without showing its new end? */
    isEndUnknown(spellId: number): boolean {
        const key = this.findKey(spellId);
        return key !== undefined && (this.guessed.has(key) || this.unsure.has(key));
    }

    /** The buff was renewed without showing its new end (a food eaten where Well Fed is kept secret). */
    forgetEnd(spellId: number): void {
        const key = this.findKey(spellId);
        if (key === undefined) return;
        this.unsure.add(key);
        this.recorded.add(key);
    }
    /** Is anything known of the buff: seen, cast, seen gone, or lost with a death? */
    hasRecord(spellId: number): boolean {
        const key = this.findKey(spellId);
        return key !== undefined && this.recorded.has(key);
    }

    /**
     * The player died: a buff that falls off with death for sure is gone, and known to be; of any other (a flask stays)
     * nothing is known any more.
     */
    forgetOnDeath(isLost: (name: string) => boolean): void {
        // A buff stays held past its end, until seen gone: every buff known as up or of unknown end is here
        for (const [key] of this.heldNames) {
            this.heldNames.delete(key);
            this.guessed.delete(key);
            this.unsure.delete(key);
            if (isLost(this.names.get(key) ?? key)) this.recorded.add(key);
            else this.recorded.delete(key);
        }
        for (const [key] of this.heldCategories) this.heldCategories.delete(key);
    }

    /** What the memory holds, as plain tables, for the saved settings (a /reload). */
    buildSnapshot(): BuffMemorySnapshot {
        const convertToObject = <T>(map: LuaMap<string, T>): { [key: string]: T } => {
            const result: { [key: string]: T } = {};
            for (const [key, value] of map) result[key] = value;
            return result;
        };
        const convertToList = (set: LuaSet<string>): string[] => {
            const result: string[] = [];
            for (const key of set) result.push(key);
            return result;
        };
        return {
            held: convertToObject(this.heldNames),
            categories: convertToObject(this.heldCategories),
            castAt: convertToObject(this.castAt),
            names: convertToObject(this.names),
            guessed: convertToList(this.guessed),
            unsure: convertToList(this.unsure),
            recorded: convertToList(this.recorded),
        };
    }

    /**
     * Takes back what a /reload saved (see buildSnapshot), on top of an empty memory. The names by their key as it is now: an
     * older build saved them by another (with spaces).
     */
    restoreSnapshot(snapshot: BuffMemorySnapshot): void {
        for (const [key, value] of pairs(snapshot.held)) this.heldNames.set(buildNameKey(key as string), value);
        for (const [key, value] of pairs(snapshot.categories)) this.heldCategories.set(key as string, value);
        for (const [key, value] of pairs(snapshot.castAt)) this.castAt.set(buildNameKey(key as string), value);
        for (const [key, value] of pairs(snapshot.names)) this.names.set(buildNameKey(key as string), value);
        for (const key of snapshot.guessed) this.guessed.add(buildNameKey(key));
        for (const key of snapshot.unsure) this.unsure.add(buildNameKey(key));
        for (const key of snapshot.recorded) this.recorded.add(buildNameKey(key));
    }

    /** The buff is known of now, under its name; `isGuessed`: cast with no known length, so its end is only guessed. */
    private noteKnown(key: string, name: string, isGuessed: boolean): void {
        this.names.set(key, name);
        this.recorded.add(key);
        this.unsure.delete(key);
        if (isGuessed) this.guessed.add(key);
        else this.guessed.delete(key);
    }

    private findKey(spellId: number): string | undefined {
        const name = this.spells.getSpellLabel(spellId);
        return name !== undefined && name !== "" ? buildNameKey(name) : undefined;
    }

    /** How long a buff lasts when known: its category's, a form's, as learned from its aura, or by the class buff list. */
    private findKnownSeconds(
        key: string,
        spellId: number | undefined,
        name: string,
        categorySeconds: number | undefined,
    ): number | undefined {
        if (categorySeconds !== undefined) return categorySeconds;
        if (this.knowledge.isFormKey(key)) return FORM_SECONDS;
        return this.findLearned(key) ?? this.knowledge.findSeconds(spellId, name);
    }

    /**
     * When the memory of a buff runs out: at its known end, or after its usual duration when it was
     * cast, was seen without an end, or is not remembered any more. Undefined: keep what is held.
     */
    private findExpiry(key: string, now: number, seconds: number, remain: number | undefined, isFromCast: boolean): number | undefined {
        if (remain !== undefined && hasKnownExpiry(remain)) return now + remain;
        const isRenewal = isFromCast || remain !== undefined || (this.heldNames.get(key) ?? 0) <= now;
        return isRenewal ? now + seconds : undefined;
    }
}
