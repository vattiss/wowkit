// The target and the enemies around: whether the target is an enemy, how far, whether it attacks the player, what kind
// of creature it is, and how many enemies are fighting the player.
import type { ClockService, PlayerService, UnitsService, CharacterService } from "@wowkit/wow";
import type { CreatureList } from "../knowledge/step.interface";

/** The enemy count is reused for this long. */
const COUNT_REUSE = 0.3;
const MAX_NAMEPLATES = 40;
/** Canonical creature types: other client words for the same type. */
const CREATURE_ALIASES: { [type: string]: string | undefined } = { machine: "mechanical" };

export class TargetService {
    private countedAt = 0;
    private countedYards = 0;
    private count = 0;

    constructor(
        private readonly units: UnitsService,
        private readonly player: PlayerService,
        private readonly character: CharacterService,
        private readonly clock: ClockService,
    ) {}

    /** A living enemy target: hostile or neutral (reaction 4 or lower). A reaction the client hides counts as an enemy. */
    isHostile(): boolean {
        if (!this.units.doesExist("target") || this.units.isDead("target") === true) return false;
        const reaction = this.units.getReaction("target");
        return reaction === undefined || reaction <= 4;
    }

    /** How far the unit is: [nearest, farthest] in yards; undefined ends are unknown. */
    getRangeBand(unit: UnitToken = "target"): LuaMultiReturn<[nearest: number | undefined, farthest: number | undefined]> {
        return this.units.getRangeBand(unit);
    }

    /**
     * Does the target attack the player? The threat state first (readable for the player against the target: 2 or 3 is
     * aggro), the target's target only as a fallback (compound tokens are secret on restricted maps). Undefined: unknown.
     */
    doesTargetAttackPlayer(): boolean | undefined {
        if (!this.units.doesExist("target")) return false;
        const status = this.units.getThreatStatus("target");
        if (status !== undefined) return status >= 2;
        if (!this.units.doesExist("targettarget")) return false;
        return this.units.isSameUnit("targettarget", "player");
    }

    /** An elite, a rare elite, a boss, or a target well above the player's level. */
    isRaidMob(): boolean {
        if (!this.units.doesExist("target")) return false;
        const classification = this.units.getClassification("target");
        if (classification === "worldboss" || classification === "rareelite" || classification === "elite") return true;
        const targetLevel = this.units.getLevel("target");
        const level = this.character.getLevel();
        return targetLevel !== undefined && level !== undefined && (targetLevel < 0 || targetLevel > level + 2);
    }

    /** Is the target of a type in the list? An unknown type (the client hides it for NPCs) is not. */
    isCreatureIn(list: CreatureList): boolean {
        const creature = this.getCreatureType();
        if (creature === undefined) return false;
        if (list === true) return creature === "mechanical" || creature === "elemental";
        return list.some((name) => (CREATURE_ALIASES[name] ?? name) === creature);
    }

    /** Is the target's type known? */
    isCreatureKnown(): boolean {
        return this.getCreatureType() !== undefined;
    }

    /**
     * Enemies fighting the player within `maxYards` (any distance when undefined). In combat only the ones on the
     * player's threat table or targeting the player or the pet count; out of combat every hostile nameplate does.
     */
    countEnemies(maxYards?: number): number {
        const now = this.clock.getCurrentTime();
        const yards = maxYards ?? 0;
        if (this.countedAt > 0 && now - this.countedAt < COUNT_REUSE && this.countedYards === yards) return this.count;
        let count = 0;
        for (let i = 1; i <= MAX_NAMEPLATES; i++) {
            const unit: UnitToken = `nameplate${i}`;
            if (this.isAttackable(unit) && this.isInFight(unit) && this.isWithinYards(unit, maxYards)) count += 1;
        }
        if (count < 1 && this.isAttackable("target") && this.isWithinYards("target", maxYards)) count = 1;
        this.countedAt = now;
        this.countedYards = yards;
        this.count = count;
        return count;
    }

    private getCreatureType(): string | undefined {
        const creature = this.units.getCreatureType("target");
        return creature !== undefined ? (CREATURE_ALIASES[creature] ?? creature) : undefined;
    }

    private isAttackable(unit: UnitToken): boolean {
        return this.units.doesExist(unit) && this.units.isDead(unit) !== true && this.units.canAttack(unit);
    }

    private isInFight(unit: UnitToken): boolean {
        if (!this.player.isInCombat()) return true;
        // On the player's threat table is decisive; off it, the mob may still be fighting the pet
        const isOnTable = this.units.isOnThreatTable(unit);
        if (isOnTable === true) return true;
        for (const who of ["player", "pet"] as const) {
            if (this.units.isSameUnit(`${unit}target`, who) === true) return true;
        }
        if (isOnTable === false) return false;
        return this.units.isInCombat(unit) === true;
    }

    private isWithinYards(unit: UnitToken, maxYards: number | undefined): boolean {
        if (maxYards === undefined || maxYards <= 0) return true;
        const [nearest, farthest] = this.units.getRangeBand(unit);
        if (nearest !== undefined && nearest > maxYards) return false;
        if (farthest !== undefined && farthest <= maxYards) return true;
        if (maxYards <= 10) return this.units.isWithinDuelDistance(unit) === true;
        if (maxYards <= 28) return this.units.isWithinInspectDistance(unit) !== false;
        return true;
    }
}
