// The player: combat, the states that keep reminders quiet (dead, mounted, eating, in town), the
// class and the equipped weapons.
import { OFF_HAND_SLOT } from "../constants";
import { attempt, attemptMulti, getReadable, isReadable, tryCall } from "./safe";

export function isInCombat(): boolean {
    const [didSucceed, isFighting] = tryCall(UnitAffectingCombat, "player");
    if (!didSucceed) return false;
    if (isReadable(isFighting)) return isFighting === true;
    // A secret answer: only comparing with nil is allowed
    return isFighting !== undefined;
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

/** In a town or an inn. */
export function isResting(): boolean {
    return attempt(IsResting) === true;
}

export function isSwimming(): boolean {
    return attempt(IsSwimming) === true;
}

/** Nothing is shown while dead, on a taxi, mounted, eating, or (when asked) resting in town. */
export function shouldStayIdle(shouldStayQuietWhenResting: boolean): boolean {
    if (attempt(UnitIsDeadOrGhost, "player") === true) return true;
    if (attempt(UnitOnTaxi, "player") === true) return true;
    if (attempt(IsMounted) === true) return true;
    if (isEating()) return true;
    // A town or an inn: nobody fights there
    return shouldStayQuietWhenResting && !isInCombat() && isResting();
}

/** The player's class token ("PRIEST"). */
export function getClassToken(): string | undefined {
    const [, classFile] = UnitClass("player");
    if (classFile !== undefined && isReadable(classFile)) return string.upper(classFile);
    const [base] = UnitClassBase("player");
    if (base !== undefined && isReadable(base)) return string.upper(base);
    return undefined;
}

/** The item ID in an equipment slot; undefined when the slot is empty. */
export function getEquippedItemId(slot: number): number | undefined {
    const itemId = attempt(GetInventoryItemID, "player", slot);
    return type(itemId) === "number" ? itemId : undefined;
}

/** Is a weapon (not a shield or a held item) in the off-hand slot? */
export function isOffhandWeaponEquipped(): boolean {
    const itemId = getEquippedItemId(OFF_HAND_SLOT);
    if (itemId === undefined) return false;
    const [, , , , , classId] = C_Item.GetItemInfoInstant(itemId);
    return classId === Enum.ItemClass.Weapon;
}

/** The name of the spell being cast now; undefined when none, or when the client hides it. */
export function getCastingSpellName(): string | undefined {
    const [didSucceed, name] = attemptMulti(() => UnitCastingInfo("player"));
    return didSucceed && isReadable(name) && type(name) === "string" ? name : undefined;
}
