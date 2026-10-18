// Units other than the player's own state: the target, the pet, party members, nameplates. Who they are, how far, how
// hurt, what they cast. The client hides much of this in combat (secret values) or for units that are not
// player-controlled; an answer it hid comes back as undefined.
import { attempt, attemptMulti, tryCall } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";
import type { PlayerService } from "./player.service";

/** What the target is casting. */
export interface UnitCast {
    isCasting: boolean;
    /** The cast cannot be interrupted (a readable "not interruptible"). */
    isShielded: boolean;
}

/** Interact distances of the client: 3 duel (~10 yd), 2 trade (~11 yd), 1 inspect (~28 yd). */
const DUEL_DISTANCE = 3;
const TRADE_DISTANCE = 2;
const INSPECT_DISTANCE = 1;

export class UnitsService {
    constructor(private readonly player: PlayerService) {}

    doesExist(unit: UnitToken): boolean {
        return attempt(UnitExists, unit) === true;
    }

    /** Dead; undefined when the client hides it. */
    isDead(unit: UnitToken): boolean | undefined {
        const [didSucceed, isDead] = tryCall(UnitIsDead, unit);
        return didSucceed && isReadable(isDead) ? isDead === true : undefined;
    }

    isDeadOrGhost(unit: UnitToken): boolean {
        return attempt(UnitIsDeadOrGhost, unit) === true;
    }

    /** How the unit stands to the player: 1 hated ... 4 neutral ... 8 exalted; undefined when the client hides it. */
    getReaction(unit: UnitToken): number | undefined {
        const reaction = getReadable(attempt(UnitReaction, "player", unit));
        return type(reaction) === "number" ? reaction : undefined;
    }

    /** A living unit the player cannot attack and that is friendly to them. */
    isFriend(unit: UnitToken): boolean {
        if (!this.doesExist(unit) || this.isDead(unit) === true) return false;
        const [didSucceed, canAttack] = tryCall(UnitCanAttack, "player", unit);
        if (didSucceed && !isReadable(canAttack)) return false;
        if (canAttack === true) return false;
        const reaction = getReadable(attempt(UnitReaction, "player", unit));
        if (reaction !== undefined) return reaction > 4;
        return didSucceed && canAttack === false;
    }

    /** Hostile and attackable (nameplates); a hidden answer counts as no. */
    canAttack(unit: UnitToken): boolean {
        return getReadable(attempt(UnitCanAttack, "player", unit)) === true;
    }

    isPlayer(unit: UnitToken): boolean {
        return attempt(UnitIsPlayer, unit) === true;
    }

    /** Are the two tokens the same unit? Undefined when the client hides it (compound tokens in combat). */
    isSameUnit(unit: UnitToken, other: UnitToken): boolean | undefined {
        const [didSucceed, isSame] = tryCall(UnitIsUnit, unit, other);
        return didSucceed && isReadable(isSame) ? isSame === true : undefined;
    }

    /** In combat; undefined when the client hides it. */
    isInCombat(unit: UnitToken): boolean | undefined {
        const [didSucceed, isFighting] = tryCall(UnitAffectingCombat, unit);
        return didSucceed && isReadable(isFighting) ? isFighting === true : undefined;
    }

    /** The unit's GUID; undefined when the client hides it (an NPC's GUID is secret on restricted maps). */
    getGuid(unit: UnitToken): string | undefined {
        const guid = getReadable(attempt(UnitGUID, unit));
        return type(guid) === "string" ? guid : undefined;
    }

    getLevel(unit: UnitToken): number | undefined {
        const level = getReadable(attempt(UnitLevel, unit));
        return type(level) === "number" ? level : undefined;
    }

    /** "normal", "elite", "rareelite", "worldboss", ...; undefined when hidden. */
    getClassification(unit: UnitToken): string | undefined {
        const classification = getReadable(attempt(UnitClassification, unit));
        return type(classification) === "string" ? classification : undefined;
    }

    /** The creature type in lower case ("undead", "mechanical"); undefined when the client hides it. */
    getCreatureType(unit: UnitToken): string | undefined {
        if (!this.doesExist(unit)) return undefined;
        const [didSucceed, name] = attemptMulti(() => UnitCreatureType(unit));
        if (!didSucceed || !isReadable(name) || type(name) !== "string" || name === "") return undefined;
        return string.lower(name!);
    }

    /** The threat state of the player on the unit (2 or 3: the player has aggro); undefined when hidden or not on the table. */
    getThreatStatus(unit: UnitToken): number | undefined {
        const status = getReadable(attempt(UnitThreatSituation, "player", unit));
        return type(status) === "number" ? status : undefined;
    }

    /** Is the unit on the player's threat table at all? Undefined when the client hides it. */
    isOnThreatTable(unit: UnitToken): boolean | undefined {
        const [didSucceed, status] = tryCall(UnitThreatSituation, "player", unit);
        if (!didSucceed || (status !== undefined && !isReadable(status))) return undefined;
        return status !== undefined;
    }

    /** Health in percent; undefined when the client hides it. */
    getHealthPercent(unit: UnitToken): number | undefined {
        const health = getReadable(attempt(UnitHealth, unit));
        const max = getReadable(attempt(UnitHealthMax, unit));
        if (health !== undefined && max !== undefined && max > 0) return (health / max) * 100;
        // The plain values are hidden: the percentage may still be readable
        const curve = CurveConstants?.ScaleTo100;
        if (curve === undefined) return undefined;
        const percent = getReadable(attempt(UnitHealthPercent, unit, true, curve));
        return type(percent) === "number" ? (percent as unknown as number) : undefined;
    }

    getMaxHealth(unit: UnitToken): number | undefined {
        const max = getReadable(attempt(UnitHealthMax, unit));
        return max !== undefined && max > 0 ? max : undefined;
    }

    /** The unit's power of a kind (0 mana, 1 rage, 3 energy): current and maximum; undefined when hidden. */
    readPower(unit: UnitToken, powerType: number): { current: number; max: number } | undefined {
        const current = getReadable(attempt(UnitPower, unit, powerType as Enum.PowerType));
        const max = getReadable(attempt(UnitPowerMax, unit, powerType as Enum.PowerType));
        if (type(current) !== "number" || type(max) !== "number") return undefined;
        return { current: current!, max: max! };
    }

    /** The unit is casting or channeling; a readable "not interruptible" marks the cast shielded. */
    readCast(unit: UnitToken): UnitCast {
        const casting = this.readCastFrom(() => UnitCastingInfo(unit) as LuaMultiReturn<unknown[]>, 8);
        if (casting.isCasting) return casting;
        return this.readCastFrom(() => UnitChannelInfo(unit) as LuaMultiReturn<unknown[]>, 7);
    }

    /**
     * How far the unit is, as a band of yards: [nearest, farthest]. From the client's measure for group members, else
     * from the interact distances (in combat the client refuses these for a friendly unit). Undefined ends are unknown.
     */
    getRangeBand(unit: UnitToken): LuaMultiReturn<[nearest: number | undefined, farthest: number | undefined]> {
        if (!this.doesExist(unit)) return $multi(undefined, undefined);
        const [didMeasure, distanceSquared, wasChecked] = attemptMulti(() => UnitDistanceSquared(unit));
        if (didMeasure && isReadable(wasChecked) && wasChecked === true && isReadable(distanceSquared) && distanceSquared! >= 0) {
            const yards = math.sqrt(distanceSquared!);
            return $multi(yards, yards);
        }
        const isClose = this.isWithinInteract(unit, DUEL_DISTANCE) ?? this.isWithinInteract(unit, TRADE_DISTANCE);
        const isInspectable = this.isWithinInteract(unit, INSPECT_DISTANCE);
        if (isClose === true) return $multi(0, 11);
        if (isInspectable === true) return $multi(11, 28);
        if (isInspectable === false) return $multi(28, 100);
        return $multi(undefined, undefined);
    }

    /** Within the duel distance (about 10 yards); undefined when unknown. */
    isWithinDuelDistance(unit: UnitToken): boolean | undefined {
        return this.isWithinInteract(unit, DUEL_DISTANCE) ?? this.isWithinInteract(unit, TRADE_DISTANCE);
    }

    /** Within the inspect distance (about 28 yards); undefined when unknown. */
    isWithinInspectDistance(unit: UnitToken): boolean | undefined {
        return this.isWithinInteract(unit, INSPECT_DISTANCE);
    }

    private isWithinInteract(unit: UnitToken, distance: number): boolean | undefined {
        // In combat the client blocks the call for a friendly unit (ADDON_ACTION_BLOCKED); an enemy still answers
        if (this.player.isInCombat() && getReadable(attempt(UnitCanAttack, "player", unit)) === false) return undefined;
        const answer = getReadable(attempt(CheckInteractDistance, unit, distance)) as unknown;
        if (answer === true || answer === 1) return true;
        if (answer === false || answer === 0) return false;
        return undefined;
    }

    private readCastFrom(read: (this: void) => LuaMultiReturn<unknown[]>, shieldIndex: number): UnitCast {
        const results = [...(pcall(read) as unknown as LuaMultiReturn<unknown[]>)];
        if (results[0] !== true || results[1] === undefined) return { isCasting: false, isShielded: false };
        const isShielded = results[shieldIndex];
        return { isCasting: true, isShielded: isReadable(isShielded) && isShielded === true };
    }
}
