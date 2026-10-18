// The conditions of a step about the target: an enemy, how far, its level, its type, whether it attacks the player,
// how many enemies are around.
import type { CharacterService, PlayerService, SpellsService, UnitsService } from "@wowkit/wow";
import type { HealthService } from "../situation/health.service";
import type { RangeService } from "../situation/range.service";
import type { TargetService } from "../situation/target.service";
import type { CombatErrorsService } from "../state/combat-errors.service";
import type { StepContext } from "./step-check.interface";

export class TargetChecksService {
    constructor(
        private readonly target: TargetService,
        private readonly units: UnitsService,
        private readonly player: PlayerService,
        private readonly character: CharacterService,
        private readonly spells: SpellsService,
        private readonly range: RangeService,
        private readonly health: HealthService,
        private readonly errors: CombatErrorsService,
    ) {}

    checkEnemy(): string | undefined {
        return this.target.isHostile() ? undefined : "needs an enemy target";
    }

    /**
     * A spell without a range of its own (a racial), at the pull: the target is near, so it is not the one spell pressable
     * against a far target. In a fight it does not matter: a hunter fights right at the edge of the client's distance
     * bands (28 yards), where the answer flips as the mob moves, and the racial would blink on and off.
     */
    checkReach(c: StepContext): string | undefined {
        if (this.player.isInCombat()) return undefined;
        const [, farthest] = this.target.getRangeBand("target");
        if (farthest === undefined) return "the target's distance is unknown";
        return farthest > c.opt.reach! ? `the target is farther than ${c.opt.reach} yards` : undefined;
    }

    /** The target is below the player's level (an unknown level counts as not). */
    checkWeakTarget(): string | undefined {
        const targetLevel = this.units.getLevel("target");
        const level = this.character.getLevel();
        if (targetLevel !== undefined && level !== undefined && targetLevel >= 0 && targetLevel < level) return undefined;
        return "the target is not below your level";
    }

    checkNoCreature(c: StepContext): string | undefined {
        return this.target.isCreatureIn(c.opt.noCreature!) ? "no effect on this creature type" : undefined;
    }

    /** An unknown type lets the step through: the spell's own usable check still refuses a wrong target. */
    checkCreature(c: StepContext): string | undefined {
        if (!this.target.isCreatureKnown()) return undefined;
        return this.target.isCreatureIn(c.opt.creature!) ? undefined : "only for another creature type";
    }

    checkEnemies(c: StepContext): string | undefined {
        return this.target.countEnemies(c.opt.enemiesYards) < c.opt.enemiesMin! ? "not enough enemies near you" : undefined;
    }

    /** A DoT or a mark is not worth it on a target that is almost dead. */
    checkDying(): string | undefined {
        if (!this.target.isHostile()) return undefined;
        const floor = this.target.isRaidMob() ? 5 : 20;
        return this.health.getHealth("target") < floor ? "target is almost dead" : undefined;
    }

    checkTargetMana(): string | undefined {
        const mana = this.units.readPower("target", 0);
        return mana === undefined || mana.current <= 0 || mana.max <= 0 ? "target has no mana" : undefined;
    }

    checkAttacked(): string | undefined {
        return this.target.doesTargetAttackPlayer() === true ? undefined : "only when the target attacks you";
    }

    /** Backstab and Shred: a mob faces whoever it attacks, so not while it attacks the player; after "must be behind", wait. */
    checkBehind(): string | undefined {
        if (this.errors.hasFailedBehindRecently()) return "you were not behind the target";
        return this.target.doesTargetAttackPlayer() !== false ? "the target is facing you" : undefined;
    }

    /** Cast-time spells a melee build only uses to pull; a spell ID: only once that spell is learned. */
    checkNotInMelee(c: StepContext): string | undefined {
        const only = c.opt.notInMelee!;
        const isLimited = only === true || this.spells.isLearned(only);
        return isLimited && this.range.isTargetInMelee() ? "not in melee range" : undefined;
    }

    checkInMelee(): string | undefined {
        return this.range.isTargetInMelee() ? undefined : "only when the target is in melee range";
    }
}
