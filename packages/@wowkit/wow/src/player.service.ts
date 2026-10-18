// The player: combat, the states that keep reminders quiet (dead, mounted, eating, in town), the
// class and the equipped weapons.

import { Consumable } from "@wowkit/wow-data";
import { attempt, attemptMulti, tryCall } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";
import { OFF_HAND_SLOT } from "./wow.constants";

export class PlayerService {
    /** The lowercase names of the eating and drinking buffs (every food gives "Food", every drink "Drink", in the client's language). */
    private eatingNames: LuaSet<string> | undefined;

    isInCombat(): boolean {
        const [didSucceed, isFighting] = tryCall(UnitAffectingCombat, "player");
        if (!didSucceed) return false;
        if (isReadable(isFighting)) return isFighting === true;
        // A secret answer: only comparing with nil is allowed
        return isFighting !== undefined;
    }

    /** In a town or an inn. */
    isResting(): boolean {
        return attempt(IsResting) === true;
    }

    isSwimming(): boolean {
        return attempt(IsSwimming) === true;
    }

    isDead(): boolean {
        return attempt(UnitIsDeadOrGhost, "player") === true;
    }

    isOnTaxi(): boolean {
        return attempt(UnitOnTaxi, "player") === true;
    }

    /** Has the player a target? */
    hasTarget(): boolean {
        return attempt(UnitExists, "target") === true;
    }

    isMounted(): boolean {
        return attempt(IsMounted) === true;
    }

    /** The player's class token ("PRIEST"). */
    getClassToken(): string | undefined {
        const [, classFile] = UnitClass("player");
        if (classFile !== undefined && isReadable(classFile)) return string.upper(classFile);
        const [base] = UnitClassBase("player");
        if (base !== undefined && isReadable(base)) return string.upper(base);
        return undefined;
    }

    /** The item ID in an equipment slot; undefined when the slot is empty. */
    getEquippedItemId(slot: number): number | undefined {
        const itemId = attempt(GetInventoryItemID, "player", slot);
        return type(itemId) === "number" ? itemId : undefined;
    }

    /** Is a weapon (not a shield or a held item) in the off-hand slot? */
    isOffhandWeaponEquipped(): boolean {
        const itemId = this.getEquippedItemId(OFF_HAND_SLOT);
        if (itemId === undefined) return false;
        const [, , , , , classId] = C_Item.GetItemInfoInstant(itemId);
        return classId === Enum.ItemClass.Weapon;
    }

    /** The name of the spell being cast now; undefined when none, or when the client hides it. */
    getCastingSpellName(): string | undefined {
        const [didSucceed, name] = attemptMulti(() => UnitCastingInfo("player"));
        return didSucceed && isReadable(name) && type(name) === "string" ? name : undefined;
    }

    /** Is the player eating or drinking (a food or drink buff)? */
    isEating(): boolean {
        for (let i = 1; i <= 40; i++) {
            const aura = attempt(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL");
            if (!aura) return false;
            const name = getReadable(aura.name);
            if (name !== undefined && this.getEatingNames().has(string.lower(name))) return true;
        }
        return false;
    }

    private getEatingNames(): LuaSet<string> {
        if (this.eatingNames) return this.eatingNames;
        const names = new LuaSet<string>();
        for (const [spellId, english] of [
            [Consumable.Food, "food"],
            [Consumable.Drink, "drink"],
        ] as const) {
            // The English name too, for a client that does not name the spell
            names.add(english);
            const name = getReadable(attempt(C_Spell.GetSpellInfo, spellId)?.name);
            if (name !== undefined && name !== "") names.add(string.lower(name));
        }
        this.eatingNames = names;
        return names;
    }
}
