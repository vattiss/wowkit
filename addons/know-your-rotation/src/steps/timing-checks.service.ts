// The conditions of a step about time and health: the hold after the last cast, the health threshold (with the smart
// heal threshold), a proc the client must report usable, and the spell's own cooldown.
import type { CharacterService, SpellDetailsService } from "@wowkit/wow";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { HealthService } from "../situation/health.service";
import type { CastStateService } from "../state/cast-state.service";
import type { ComboService } from "../state/combo.service";
import type { CooldownTrackerService } from "../state/cooldown-tracker.service";
import type { HoldTrackerService } from "../state/hold-tracker.service";
import type { StepContext } from "./step-check.interface";

/** Without its own threshold a heal is offered below this. */
const HEAL_THRESHOLD = 99;
/** A cast in progress hides the "not usable" of spells right after it for this long. */
const CAST_SETTLE = 1.55;

export class TimingChecksService {
    constructor(
        private readonly character: CharacterService,
        private readonly details: SpellDetailsService,
        private readonly traits: SpellTraitsService,
        private readonly health: HealthService,
        private readonly combo: ComboService,
        private readonly cooldownTracker: CooldownTrackerService,
        private readonly holds: HoldTrackerService,
        private readonly castState: CastStateService,
    ) {}

    /** Fillers are spammed by design: no hold holds them back. */
    checkHold(c: StepContext): string | undefined {
        return c.opt.isFiller !== true && this.holds.getHoldRemaining(c.id) > c.gate ? "waiting after the last cast (delay)" : undefined;
    }

    /** The health threshold: the player's, the healed unit's, or the target's. */
    checkHealth(c: StepContext): string | undefined {
        const opt = c.opt;
        const isHeal = opt.isHeal === true || this.traits.isHealSpell(c.id, opt);
        const threshold = this.findThreshold(c, isHeal);
        if (threshold === undefined) return undefined;
        const unit = opt.unit ?? (c.isHelpful || opt.isHeal === true ? this.health.findHealUnit(opt) : "player");
        if (this.health.getHealth(unit) <= threshold) return undefined;
        if (!this.health.isHealthHidden(unit)) return "health is above the heal threshold";
        // A heal for a party member the player selected is offered as it is (its glow is lit by that member's health);
        // the player's own health is followed by the colored glow instead, and a friend outside the group gets nothing
        if (isHeal && unit !== "player" && this.character.isInMyGroup(unit)) return undefined;
        return "health is hidden by the game (the colored glow follows it)";
    }

    /** The health percent at or below which the step is offered; undefined: no health check. */
    private findThreshold(c: StepContext, isHeal: boolean): number | undefined {
        const opt = c.opt;
        // The health is hidden: the caller shows the threshold another way
        if (opt.isHealthUnchecked === true) return undefined;
        const threshold = opt.hpPerCombo !== undefined ? this.combo.getComboPoints() * opt.hpPerCombo : opt.hp;
        if (!isHeal) return threshold;
        return this.health.getAutoHealThreshold(c.id, opt.unit ?? this.health.findHealUnit(opt), threshold ?? HEAL_THRESHOLD);
    }

    /** A proc (Overpower, Revenge) or a spell the client must report usable (Exorcism, Backstab). */
    checkUsable(c: StepContext): string | undefined {
        if (c.opt.proc === undefined && c.opt.isUsableOnly !== true) return undefined;
        if (this.details.readUsability(c.id).isUsable === true) return undefined;
        if (c.opt.proc !== undefined) return "waiting for its proc";
        if (this.castState.getCastRemaining() > 0 || this.castState.getSecondsSinceLastCast() < CAST_SETTLE) return undefined;
        return "not usable right now";
    }

    /** The spell's own cooldown (the one being cast now counts as ready; one ending with the cast too). */
    checkCooldown(c: StepContext): string | undefined {
        let [remain] = this.cooldownTracker.readCooldown(c.id);
        if (this.castState.isCasting(c.id)) remain = 0;
        else {
            const castLeft = this.castState.getCastRemaining();
            if (castLeft > 0 && remain > 0 && remain <= castLeft + 0.45) remain = 0;
        }
        return remain > c.gate ? "on cooldown" : undefined;
    }
}
