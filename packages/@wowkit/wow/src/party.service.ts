// The other members of the player's party.

import { attempt, attemptMulti } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";

export interface UnitIdentity {
    name: string;
    classToken: string;
}

export class PartyService {
    isInRaid(): boolean {
        return attempt(UnitExists, "raid1") === true;
    }

    /** The party members (party1..4) that exist. */
    getPartyUnits(): UnitToken[] {
        const units: UnitToken[] = [];
        for (let i = 1; i <= 4; i++) {
            const unit: UnitToken = `party${i as 1 | 2 | 3 | 4}`;
            if (attempt(UnitExists, unit) === true) units.push(unit);
        }
        return units;
    }

    /** Online, alive and visible: within reach of a spell. */
    isReachable(unit: UnitToken): boolean {
        return (
            attempt(UnitIsConnected, unit) === true && attempt(UnitIsDeadOrGhost, unit) !== true && attempt(UnitIsVisible, unit) === true
        );
    }

    /** Within casting range of the spell; the party range check when the spell cannot tell. */
    isInSpellRange(spellId: number, unit: UnitToken): boolean {
        const isInRange = getReadable(attempt(C_Spell.IsSpellInRange, spellId, unit));
        if (isInRange !== undefined) return isInRange;
        const [didSucceed, isNear, wasChecked] = attemptMulti(() => UnitInRange(unit));
        if (!didSucceed || !isReadable(wasChecked) || wasChecked !== true) return true;
        return isReadable(isNear) && isNear === true;
    }

    doesUseMana(unit: UnitToken): boolean {
        const [didSucceed, powerType] = attemptMulti(() => UnitPowerType(unit));
        return didSucceed && isReadable(powerType) && powerType === Enum.PowerType.Mana;
    }

    /** The unit's name and class token, for messages and Greater Blessings. */
    getUnitIdentity(unit: UnitToken): UnitIdentity {
        const [didReadName, name] = attemptMulti(() => UnitName(unit));
        const [didReadClass, , classFile] = attemptMulti(() => UnitClass(unit));
        return {
            name: didReadName && isReadable(name) && name !== undefined ? name : unit,
            classToken: didReadClass && isReadable(classFile) && classFile !== undefined ? classFile : "?",
        };
    }
}
