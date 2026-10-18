// Is a step offered right now? Its conditions, in order (the first that refuses gives the reason), then whether the
// spell can be pressed: its cooldown, the client's "usable", its cost, the range.
import type { SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { StepOptions } from "../knowledge/step.interface";
import type { HealthService } from "../situation/health.service";
import type { RangeService } from "../situation/range.service";
import type { CastStateService } from "../state/cast-state.service";
import type { CooldownTrackerService } from "../state/cooldown-tracker.service";
import type { ShotTimingService } from "../state/shot-timing.service";
import type { StepCheck, StepChecks, StepContext } from "./step-check.interface";

/** Under this many seconds a cooldown counts as over. */
const READY_MARGIN = 0.2;
/** The client marks spells unusable during the global cooldown that follows a cast. */
const CAST_SETTLE = 1.55;

export class StepService {
    /** The checks in order: the option each belongs to ("always": every step), and the check. */
    private readonly checks: [option: keyof StepOptions | "always", check: StepCheck][];
    private reason: string | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly units: UnitsService,
        private readonly traits: SpellTraitsService,
        private readonly health: HealthService,
        private readonly range: RangeService,
        private readonly cooldownTracker: CooldownTrackerService,
        private readonly castState: CastStateService,
        private readonly shotTiming: ShotTimingService,
        checks: StepChecks,
    ) {
        this.checks = this.listChecks(checks);
    }

    /** The checks in their order: the first that refuses gives the reason, and the aura checks clear holds before the hold check. */
    private listChecks(checks: StepChecks): [option: keyof StepOptions | "always", check: StepCheck][] {
        const { target: t, player: p, aura: a, timing: time } = checks;
        return [
            ["isAttack", () => t.checkEnemy()],
            ["minLevel", (c) => p.checkMinLevel(c)],
            ["maxLevel", (c) => p.checkMaxLevel(c)],
            ["reach", (c) => t.checkReach(c)],
            ["isForWeakTarget", () => t.checkWeakTarget()],
            ["isAutoRepeat", (c) => p.checkAutoRepeat(c)],
            ["isFightOnly", () => p.checkFight()],
            ["isWithEnemyTarget", () => p.checkEnemyTarget()],
            ["needKnownAny", (c) => p.checkKnownAny(c)],
            ["noCreature", (c) => t.checkNoCreature(c)],
            ["creature", (c) => t.checkCreature(c)],
            ["isTotem", (c) => p.checkTotem(c)],
            ["enemiesMin", (c) => t.checkEnemies(c)],
            ["shouldSkipDying", () => t.checkDying()],
            ["isForManaUsers", () => t.checkTargetMana()],
            ["isWhenAttacked", () => t.checkAttacked()],
            ["isFromBehind", () => t.checkBehind()],
            ["notInMelee", (c) => t.checkNotInMelee(c)],
            ["isInMeleeOnly", () => t.checkInMelee()],
            ["notKnown", (c) => p.checkNotKnown(c)],
            ["notTree", (c) => p.checkNotTree(c)],
            ["isSwimmingOnly", () => p.checkSwimming()],
            ["isGroupOnly", (c) => p.checkGroup(c)],
            ["isPetDeadOnly", () => p.checkPetDead()],
            ["isPetAliveOnly", () => p.checkPetAlive()],
            ["isKeptUp", (c) => a.checkKeptUp(c)],
            ["keepsDebuff", (c) => a.checkKeptDebuff(c)],
            ["always", (c) => time.checkHold(c)],
            ["always", (c) => time.checkHealth(c)],
            ["form", (c) => p.checkForm(c)],
            ["noForm", (c) => p.checkNoForm(c)],
            ["isCombatOnly", () => p.checkCombat()],
            ["comboMin", (c) => p.checkCombo(c)],
            ["isWithPet", () => p.checkPet()],
            ["isWithoutPet", () => p.checkNoPet()],
            ["isWithTamedPet", () => p.checkTamedPet()],
            ["isOutOfCombatOnly", () => p.checkOutOfCombat()],
            ["needBuff", (c) => a.checkNeedBuff(c)],
            ["needAnyBuff", (c) => a.checkNeedAnyBuff(c)],
            ["needDebuff", (c) => a.checkNeedDebuff(c)],
            ["always", (c) => time.checkUsable(c)],
            ["manaMax", (c) => p.checkManaMax(c)],
            ["hpMin", (c) => p.checkHealthMin(c)],
            ["anyBuff", (c) => a.checkAnyBuff(c)],
            ["anyDebuff", (c) => a.checkAnyDebuff(c)],
            ["always", (c) => time.checkCooldown(c)],
        ];
    }

    /** Is the step offered now? `shift`: look-ahead seconds (at least 0.2). getRefusalReason() then says why not. */
    isStepOffered(spellId: number, opt: StepOptions = {}, shift = READY_MARGIN): boolean {
        this.reason = undefined;
        const id = this.spells.resolve(spellId);
        if (id === undefined) return this.reject("not learned yet");
        const isHelpful = this.traits.isHelpful(id, opt);
        const c: StepContext = {
            id,
            opt,
            gate: math.max(shift, READY_MARGIN),
            isHelpful,
            auraUnit: isHelpful ? this.health.findHealUnit(opt) : "player",
        };
        for (const [option, check] of this.checks) {
            if (option !== "always" && opt[option] === undefined) continue;
            const why = check(c);
            if (why !== undefined) return this.reject(why);
        }
        return this.isPressable(id, opt);
    }

    /** Why the last step asked about was not offered. */
    getRefusalReason(): string | undefined {
        return this.reason;
    }

    /** Learned, off cooldown (unless `shouldIgnoreCooldown`), and not refused by the client for want of power. */
    isReady(spellId: number, opt?: StepOptions, shouldIgnoreCooldown = false): boolean {
        const id = this.spells.resolve(spellId);
        if (id === undefined) return false;
        if (!shouldIgnoreCooldown && this.cooldownTracker.readCooldown(id)[0] > READY_MARGIN) return false;
        const usability = this.details.readUsability(id);
        if (usability.isOutOfPower === true) return false;
        if (usability.isUsable === true) return true;
        if (this.traits.isOnlyHelpful(id, opt)) return this.hasPower(id);
        // The client marks other spells unusable during a cast or the global cooldown: shocks and DoTs still count
        if (usability.isUsable === false) {
            const isRightAfterCast = this.castState.getCastRemaining() > 0 || this.castState.getSecondsSinceLastCast() < CAST_SETTLE;
            return isRightAfterCast && this.hasPower(id);
        }
        return this.hasPower(id);
    }

    /** Enough power for the spell (a health cost, like Life Tap's, is not waited for). Unknown counts as enough. */
    hasPower(spellId: number): boolean {
        for (const cost of this.details.listCosts(spellId)) {
            if (cost.amount <= 0 || cost.powerType < 0) continue;
            const current = this.units.readPower("player", cost.powerType)?.current;
            if (current !== undefined && current < cost.amount) return false;
        }
        return true;
    }

    private isPressable(id: number, opt: StepOptions): boolean {
        if (opt.isAlwaysReady === true) return true;
        if (this.shotTiming.doesBlock(id)) return this.reject("would clip Auto Shot");
        if (this.isReady(id, opt, true)) return true;
        // Fillers skip the strict usable test (the client says no during a cast), but not when out of mana: the wand then
        if (opt.isFiller === true && this.details.readUsability(id).isOutOfPower !== true) return true;
        // Certainly out of range is still a candidate for slots 2-3 (the client calls it unusable)
        if (this.hasPower(id) && this.range.getRangeState(id, opt) === "out") return true;
        if (this.shotTiming.isEnergySoon(id)) return true;
        return this.reject("not usable right now (stance, rage or mana, or the client says no)");
    }

    private reject(reason: string): false {
        this.reason = reason;
        return false;
    }
}
