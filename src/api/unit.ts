// The player and the party: in combat, eating, idle (dead, mounted, in town); party members in reach.
import { attempt, attemptMulti, readable, safe, tryCall } from "../util/safe";

export function inCombat(): boolean {
    const [ok, combat] = tryCall(UnitAffectingCombat, "player");
    if (!ok) return false;
    if (readable(combat)) return combat === true;
    // A secret answer: only comparing with nil is allowed
    return combat !== undefined;
}

const EATING_AURAS = new LuaSet<string>();
EATING_AURAS.add("food");
EATING_AURAS.add("drink");

export function isEating(): boolean {
    for (let i = 1; i <= 40; i++) {
        const aura = attempt(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL");
        if (!aura) return false;
        const name = safe(aura.name);
        if (name !== undefined && EATING_AURAS.has(string.lower(name))) return true;
    }
    return false;
}

export function isResting(): boolean {
    return attempt(IsResting) === true;
}

/** The party members (party1..4) that exist; none in a raid (the party feature skips raids). */
export function partyUnits(): UnitToken[] {
    if (attempt(UnitExists, "raid1") === true) return [];
    const units: UnitToken[] = [];
    for (let i = 1; i <= 4; i++) {
        const unit: UnitToken = `party${i as 1 | 2 | 3 | 4}`;
        if (attempt(UnitExists, unit) === true) units.push(unit);
    }
    return units;
}

/** Online, alive and visible: a member a buff could land on. */
export function canReceiveBuffs(unit: UnitToken): boolean {
    return (
        attempt(UnitIsConnected, unit) === true &&
        attempt(UnitIsDeadOrGhost, unit) !== true &&
        attempt(UnitIsVisible, unit) === true
    );
}

/** Within casting range of the spell; the party range check when the spell cannot tell. */
export function inSpellRange(spellId: number, unit: UnitToken): boolean {
    const inRange = safe(attempt(C_Spell.IsSpellInRange, spellId, unit));
    if (inRange !== undefined) return inRange;
    const [ok, near, checked] = attemptMulti(() => UnitInRange(unit));
    if (!ok || !readable(checked) || checked !== true) return true;
    return readable(near) && near === true;
}

export function usesMana(unit: UnitToken): boolean {
    const [ok, powerType] = attemptMulti(() => UnitPowerType(unit));
    return ok && readable(powerType) && powerType === Enum.PowerType.Mana;
}

/** The unit's name and class token, for messages and Greater Blessings. */
export function unitIdentity(unit: UnitToken): { name: string; classToken: string } {
    const [nameOk, name] = attemptMulti(() => UnitName(unit));
    const [classOk, , classFile] = attemptMulti(() => UnitClass(unit));
    return {
        name: nameOk && readable(name) && name !== undefined ? name : unit,
        classToken: classOk && readable(classFile) && classFile !== undefined ? classFile : "?",
    };
}

/** Nothing is shown while dead, on a taxi, mounted, eating, or (with `quietResting`) resting in town. */
export function shouldStayIdle(quietResting: boolean): boolean {
    if (attempt(UnitIsDeadOrGhost, "player") === true) return true;
    if (attempt(UnitOnTaxi, "player") === true) return true;
    if (attempt(IsMounted) === true) return true;
    if (isEating()) return true;
    // A town or an inn: nobody fights there
    return quietResting && !inCombat() && isResting();
}
