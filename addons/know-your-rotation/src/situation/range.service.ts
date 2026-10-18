// Is the spell's target in range? "in", "out", "unknown", or "none" (the spell has no range: a self-cast). The yard
// band can overrule a wrong or hidden answer of the client: a melee spell stays out at a distance, and a long-range shot
// still counts as in when the client says no.
import { Druid, Hunter, Paladin, Rogue, Shaman, Warrior } from "@wowkit/wow-data";
import type { ActionBarsService, PlayerService, SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { StepOptions } from "../knowledge/step.interface";
import type { HealthService } from "./health.service";
import type { TargetService } from "./target.service";

export type RangeState = "in" | "out" | "unknown" | "none";
/** "in": confirmed in range (slot 1); "notOut": unknown is fine; "any": out of range is fine too (slots 2-3). */
export type RangeMode = "in" | "notOut" | "any";

/** A melee spell of the class: its range says whether the target is in melee range. */
const MELEE_PROBES: { [classToken: string]: number | undefined } = {
    HUNTER: Hunter.RaptorStrike,
    SHAMAN: Shaman.Stormstrike,
    WARRIOR: Warrior.HeroicStrike,
    ROGUE: Rogue.SinisterStrike,
    DRUID: Druid.Claw,
    PALADIN: Paladin.CrusaderStrike,
};

export class RangeService {
    constructor(
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly units: UnitsService,
        private readonly player: PlayerService,
        private readonly actionBars: ActionBarsService,
        private readonly traits: SpellTraitsService,
        private readonly health: HealthService,
        private readonly target: TargetService,
    ) {}

    getRangeState(spellId: number, opt: StepOptions = {}): RangeState {
        const id = this.spells.resolveOrSame(spellId);
        if (!this.doesNeedRange(id, opt)) return "none";
        const unit = this.findRangeUnit(id, opt);
        // A self-cast has no distance (the action slot would say "out of range" while an enemy is targeted)
        if (unit === "player") return "in";
        if (!this.units.doesExist(unit)) return "out";
        return this.getUnitRangeState(id, unit);
    }

    /** The range of a spell on a unit that exists, by the yard band and the client's answer. */
    private getUnitRangeState(id: number, unit: UnitToken): RangeState {
        let maxRange = this.details.getMaxRange(id);
        if (maxRange === 0 && this.traits.isHarmful(id)) maxRange = 5;
        const [nearest, farthest] = this.target.getRangeBand(unit);
        if (maxRange === undefined) return this.convertAnswer(this.isClientInRange(id), false, false);
        // A melee spell against a clearly far target is out, whatever the client says
        if (nearest !== undefined && ((maxRange <= 5 && nearest > 8) || nearest >= maxRange)) return "out";
        const isBandInside = farthest !== undefined && farthest <= maxRange;
        return this.convertAnswer(this.isClientInRange(id), isBandInside, isBandInside && maxRange > 5);
    }

    /**
     * The client's answer, overruled by the yard band: inside the band counts as in when the client cannot tell, and a
     * long-range shot inside the band counts as in even when the client says no (Forever does for some shots).
     */
    private convertAnswer(isInRange: boolean | undefined, isBandInside: boolean, canBandOverrule: boolean): RangeState {
        if (isInRange === false) return canBandOverrule ? "in" : "out";
        if (isInRange === true || isBandInside) return "in";
        return "unknown";
    }

    isInRange(spellId: number, opt: StepOptions | undefined, mode: RangeMode): boolean {
        const state = this.getRangeState(spellId, opt);
        if (state === "none" || state === "in") return true;
        if (state === "out") return mode === "any";
        return mode !== "in";
    }

    /** Does the client itself say the target is out of the spell's range (the red button)? */
    doesClientSayOutOfRange(spellId: number): boolean {
        return this.isClientInRange(spellId) === false;
    }

    /** Is an enemy target in melee range? Never for a target clearly far away. */
    isTargetInMelee(): boolean {
        if (!this.units.doesExist("target") || !this.target.isHostile()) return false;
        const [nearest, farthest] = this.target.getRangeBand("target");
        if (nearest !== undefined && nearest > 8) return false;
        if (farthest !== undefined && farthest <= 5) return true;
        const probeState = this.getProbeState();
        if (probeState === "in" || probeState === "out") return probeState === "in";
        if (nearest !== undefined && nearest <= 5) return true;
        return this.units.isWithinDuelDistance("target") === true;
    }

    /** The range of a melee spell of the class: it says whether the target is in melee range. */
    private getProbeState(): RangeState {
        const probe = MELEE_PROBES[this.player.getClassToken() ?? ""];
        return probe !== undefined ? this.getRangeState(probe, { isAttack: true }) : "unknown";
    }

    private doesNeedRange(id: number, opt: StepOptions): boolean {
        if (opt.isWithoutPet === true || opt.isOutOfCombatOnly === true) return false;
        if (opt.isHeal === true) return this.findRangeUnit(id, opt) !== "player";
        return opt.isAttack === true || this.traits.isHarmful(id);
    }

    private findRangeUnit(id: number, opt: StepOptions): UnitToken {
        if (opt.isHeal === true || this.traits.isOnlyHelpful(id, opt)) return this.health.findHealUnit(opt);
        return "target";
    }

    /** The action slot's range answer first (the bar knows the target), then the spell's, on its unit and on the target. */
    private isClientInRange(id: number): boolean | undefined {
        const slot = this.actionBars.findSlotOf(id);
        const isSlotInRange = slot !== undefined ? this.details.isActionInRange(slot) : undefined;
        if (isSlotInRange !== undefined) return isSlotInRange;
        const unit = this.traits.isHealSpell(id) || this.traits.isOnlyHelpful(id) ? this.health.findHealUnit() : "target";
        return this.details.isInRange(id, unit) ?? (unit !== "target" ? this.details.isInRange(id, "target") : undefined);
    }
}
