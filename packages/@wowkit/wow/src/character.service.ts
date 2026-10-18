// Who the player's character is: level, race, faction, talents, group. Answers that change rarely.
import { attempt, attemptMulti } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";

/** Race IDs by the client's race file name; Forever's Aeolids are 95 (Alliance) and 96 (Horde). */
const RACE_BY_FILE: { [file: string]: number | undefined } = {
    Human: 1,
    Orc: 2,
    Dwarf: 3,
    NightElf: 4,
    Scourge: 5,
    Undead: 5,
    Tauren: 6,
    Gnome: 7,
    Troll: 8,
    Aeolid: 95,
    Highborne: 95,
    Skyborne: 95,
    Windborne: 96,
};

/** The talent trees with the most points are looked up again after this long. */
const TREE_REUSE = 3;

export class CharacterService {
    private mainTree: string | undefined;
    private mainTreeAt = -10;

    getLevel(): number | undefined {
        const level = getReadable(attempt(UnitLevel, "player"));
        return type(level) === "number" ? level : undefined;
    }

    /** The race ID (1 Human ... 8 Troll, 95 / 96 Aeolid); undefined when the client does not say. */
    getRaceId(): number | undefined {
        const [didSucceed, , raceFile, raceId] = attemptMulti(() => UnitRace("player"));
        if (!didSucceed) return undefined;
        const id = getReadable(raceId);
        if (type(id) === "number") return id;
        // The client sometimes hides the number: the race file name says it too
        const file = getReadable(raceFile);
        const byFile = file !== undefined ? RACE_BY_FILE[file] : undefined;
        if (byFile === 95 && this.getFaction() === "Horde") return 96;
        return byFile;
    }

    /** "Alliance" or "Horde"; undefined when the client does not say. */
    getFaction(): string | undefined {
        const [didSucceed, faction] = attemptMulti(() => UnitFactionGroup("player"));
        return didSucceed && isReadable(faction) && type(faction) === "string" && faction !== "" ? faction : undefined;
    }

    /** In a party or a raid. */
    isInGroup(): boolean {
        return attempt(IsInGroup) === true;
    }

    /** Is the unit in the player's party or raid? A hidden answer counts as no. */
    isInMyGroup(unit: UnitToken): boolean {
        if (getReadable(attempt(UnitInParty, unit)) === true) return true;
        return type(getReadable(attempt(UnitInRaid, unit))) === "number";
    }

    /** The name of the talent tree with the most points, in lower case; undefined without points or talent data. */
    getMainTalentTree(): string | undefined {
        const now = GetTime();
        if (this.mainTreeAt > 0 && now - this.mainTreeAt < TREE_REUSE) return this.mainTree;
        this.mainTreeAt = now;
        this.mainTree = undefined;
        let bestPoints = 0;
        for (let index = 1; index <= 4; index++) {
            const [didSucceed, specId, name, , , , , points] = attemptMulti(() => C_SpecializationInfo.GetSpecializationInfo(index));
            if (!didSucceed || specId === undefined || specId === 0) break;
            const spent = tonumber(getReadable(points)) ?? 0;
            if (spent > bestPoints && type(name) === "string" && isReadable(name)) {
                bestPoints = spent;
                this.mainTree = string.lower(name!);
            }
        }
        return this.mainTree;
    }

    /** Has the hunter tamed a pet (stable slot 1 is the current pet)? Undefined when the client does not say. */
    hasTamedPet(): boolean | undefined {
        const [didSucceed, info] = attemptMulti(() => $multi(C_StableInfo.GetStablePetInfo(1)));
        if (!didSucceed) return undefined;
        return type(info) === "table";
    }

    /** Does the client cast on the unit under the mouse (the mouseover cast option)? */
    isMouseoverCastOn(): boolean {
        return attempt(C_CVar.GetCVarBool, "enableMouseoverCast") === true;
    }
}
