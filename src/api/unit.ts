// The player and the party: in combat, eating, idle (dead, mounted, in town); party members in reach.
import { attempt, attemptMulti, isReadable, getReadable, tryCall } from "../util/safe";

export function isInCombat(): boolean {
    const [didSucceed, combat] = tryCall(UnitAffectingCombat, "player");
    if (!didSucceed) return false;
    if (isReadable(combat)) return combat === true;
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
        const name = getReadable(aura.name);
        if (name !== undefined && EATING_AURAS.has(string.lower(name))) return true;
    }
    return false;
}

export function isResting(): boolean {
    return attempt(IsResting) === true;
}

/** The party members (party1..4) that exist; none in a raid (the party feature skips raids). */
export function getPartyUnits(): UnitToken[] {
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
export function isInSpellRange(spellId: number, unit: UnitToken): boolean {
    const inRange = getReadable(attempt(C_Spell.IsSpellInRange, spellId, unit));
    if (inRange !== undefined) return inRange;
    const [didSucceed, near, checked] = attemptMulti(() => UnitInRange(unit));
    if (!didSucceed || !isReadable(checked) || checked !== true) return true;
    return isReadable(near) && near === true;
}

export function doesUseMana(unit: UnitToken): boolean {
    const [didSucceed, powerType] = attemptMulti(() => UnitPowerType(unit));
    return didSucceed && isReadable(powerType) && powerType === Enum.PowerType.Mana;
}

/** The unit's name and class token, for messages and Greater Blessings. */
export function getUnitIdentity(unit: UnitToken): { name: string; classToken: string } {
    const [didReadName, name] = attemptMulti(() => UnitName(unit));
    const [didReadClass, , classFile] = attemptMulti(() => UnitClass(unit));
    return {
        name: didReadName && isReadable(name) && name !== undefined ? name : unit,
        classToken: didReadClass && isReadable(classFile) && classFile !== undefined ? classFile : "?",
    };
}

/** Nothing is shown while dead, on a taxi, mounted, eating, or (with `quietResting`) resting in town. */
export function shouldStayIdle(shouldStayQuietWhenResting: boolean): boolean {
    if (attempt(UnitIsDeadOrGhost, "player") === true) return true;
    if (attempt(UnitOnTaxi, "player") === true) return true;
    if (attempt(IsMounted) === true) return true;
    if (isEating()) return true;
    // A town or an inn: nobody fights there
    return shouldStayQuietWhenResting && !isInCombat() && isResting();
}
