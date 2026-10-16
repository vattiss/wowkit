// Remembers buffs on the player while the client hides them. In combat the client may return no
// auras at all, or auras whose name and ID are secret, so a buff seen or cast a moment ago counts
// as up until its usual duration runs out.
import { hasKnownExpiry } from "../constants";
import { findFamilyOf } from "../data/aura-families";
import { buildAuraKey } from "../util/text";
import { getSpellName } from "./spells";

/** How long a seen or cast buff lasts (seconds), for buffs outside the known families. */
export type DurationLookup = (this: void, spellId: number | undefined, name: string) => number;

/** A druid form (Cat Form, Travel Form...): no end, only changes with a shapeshift. */
const FORM_SECONDS = 1800;
/** After a cast, a missing aura is not believed for this long (it may not have arrived yet). */
const CAST_SETTLE = 1;
/** After a shapeshift, the form cast this recently is the new one. */
const FORM_CAST_SETTLE = 1.5;

function isFormKey(key: string): boolean {
    return string.find(key, " form$")[0] !== undefined;
}

export class AuraMemory {
    /** Aura key -> GetTime() when the memory runs out. */
    private readonly heldNames = new LuaMap<string, number>();
    /** Family key -> GetTime() when the memory runs out. */
    private readonly heldFamilies = new LuaMap<string, number>();
    /** Aura or family key -> GetTime() of the player's cast. */
    private readonly castAt = new LuaMap<string, number>();

    constructor(private durationOf: DurationLookup = () => 30) {}

    setDurationLookup(lookup: DurationLookup): void {
        this.durationOf = lookup;
    }

    isEmpty(): boolean {
        return this.heldNames.isEmpty() && this.heldFamilies.isEmpty();
    }

    /**
     * The buff was seen (with `remain` seconds left; undefined when unknown) or cast. A sighting
     * renews the memory: an aspect seen every few seconds never runs out.
     */
    remember(spellId: number | undefined, auraName: string | undefined, remain: number | undefined, isFromCast: boolean): void {
        const name = auraName ?? getSpellName(spellId);
        if (name === undefined || name === "") return;
        const key = buildAuraKey(name);
        const family = findFamilyOf(name);
        const seconds = family?.seconds ?? (isFormKey(key) ? FORM_SECONDS : this.durationOf(spellId, name));
        const now = GetTime();
        let expires: number | undefined;
        if (remain !== undefined && hasKnownExpiry(remain)) expires = now + remain;
        else if (isFromCast || remain !== undefined || (this.heldNames.get(key) ?? 0) <= now) expires = now + seconds;
        if (expires !== undefined) {
            this.heldNames.set(key, expires);
            if (family) this.heldFamilies.set(family.key, expires);
        }
        if (isFromCast) {
            this.castAt.set(key, now);
            if (family) this.castAt.set(family.key, now);
        }
    }

    /** Is the buff (or a member of its family) remembered as up? */
    isRemembered(spellId: number): boolean {
        const name = getSpellName(spellId);
        if (name === undefined || name === "") return false;
        const now = GetTime();
        if (now < (this.heldNames.get(buildAuraKey(name)) ?? 0)) return true;
        const family = findFamilyOf(name);
        return family !== undefined && now < (this.heldFamilies.get(family.key) ?? 0);
    }

    /** The buff was looked for and is gone. `familiesSeen`: families still up in the same scan. */
    release(spellId: number, familiesSeen: LuaMap<string, AuraData> | undefined): void {
        const name = getSpellName(spellId);
        if (name === undefined || name === "") return;
        const key = buildAuraKey(name);
        const now = GetTime();
        if (now - (this.castAt.get(key) ?? -10) < CAST_SETTLE) return;
        this.heldNames.delete(key);
        const family = findFamilyOf(name);
        if (family && !familiesSeen?.has(family.key) && now - (this.castAt.get(family.key) ?? -10) >= CAST_SETTLE) {
            this.heldFamilies.delete(family.key);
        }
    }

    /**
     * A shapeshift happened: the remembered form is out of date (in combat the aura cannot be read
     * again). A form cast a moment ago is the new one and is kept.
     */
    forgetForms(): void {
        const now = GetTime();
        for (const [key] of this.heldNames) {
            if (isFormKey(key) && now - (this.castAt.get(key) ?? -10) >= FORM_CAST_SETTLE) this.heldNames.delete(key);
        }
    }
}
