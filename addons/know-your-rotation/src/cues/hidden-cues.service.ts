// Cues on values the client hides in combat (health, mana): the step the player would press is found with its own
// threshold check switched off, and its glow is faded by the client from the hidden value (ValueCurvesService), lit only
// past the threshold. No number is ever compared by the addon.
import type { SpellsService, UnitsService } from "@wowkit/wow";
import type { Step, StepOptions } from "../knowledge/step.interface";
import type { HealthService } from "../situation/health.service";
import type { ListsService } from "../situation/lists.service";
import type { TargetService } from "../situation/target.service";
import type { CastStateService } from "../state/cast-state.service";
import type { ComboService } from "../state/combo.service";
import type { StepService } from "../steps/step.service";

/** A spell and the percent where its glow turns on. */
export interface HiddenCue {
    spellId: number;
    threshold: number;
}

interface PickRule {
    /** Does this step wait for the hidden value? */
    doesWant: (this: void, opt: StepOptions) => boolean;
    /** The option that switches the step's own value check off. */
    gate: "isHealthUnchecked" | "isManaUnchecked";
    /** An option dropped from the copy (a per-combo threshold). */
    clear?: "hpPerCombo";
    /** Skip the spell being cast right now. */
    shouldSkipCasting?: boolean;
    /** The percent where the glow turns on; undefined skips the step. */
    findThreshold: (this: void, opt: StepOptions, id: number) => number | undefined;
}

export class HiddenCuesService {
    constructor(
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly lists: ListsService,
        private readonly steps: StepService,
        private readonly health: HealthService,
        private readonly target: TargetService,
        private readonly combo: ComboService,
        private readonly castState: CastStateService,
    ) {}

    /** A heal (or a step on the player's own health, like Drain Life) while the player's health is hidden. */
    findHiddenHeal(): HiddenCue | undefined {
        if (!this.health.isHealthHidden("player")) return undefined;
        return this.pick(this.lists.getRotation(), {
            doesWant: (opt) => opt.isHeal === true || (opt.hp !== undefined && opt.unit === undefined),
            gate: "isHealthUnchecked",
            shouldSkipCasting: true,
            findThreshold: (opt, id) =>
                opt.isHeal === true ? this.health.getAutoHealThreshold(id, "player", opt.hp ?? 80) : (opt.hp ?? 80),
        });
    }

    /** A step waiting for a low target (an execute, a finisher by combo points) while the target's health is hidden. */
    findHiddenExecute(): HiddenCue | undefined {
        if (!this.target.isHostile() || !this.health.isHealthHidden("target")) return undefined;
        return this.pick(this.lists.getRotation(), {
            doesWant: (opt) => opt.unit === "target" && (opt.hp !== undefined || opt.hpPerCombo !== undefined),
            gate: "isHealthUnchecked",
            clear: "hpPerCombo",
            findThreshold: (opt) => {
                const threshold = opt.hpPerCombo !== undefined ? this.combo.getComboPoints() * opt.hpPerCombo : (opt.hp ?? 20);
                return threshold > 0 ? threshold : undefined;
            },
        });
    }

    /** The pet's heal (Mend Pet) while the pet's health is hidden. */
    findHiddenPetHeal(): HiddenCue | undefined {
        if (!this.units.doesExist("pet") || !this.health.isHealthHidden("pet")) return undefined;
        return this.pick(this.lists.getRotation(), {
            doesWant: (opt) => opt.unit === "pet" && opt.hp !== undefined,
            gate: "isHealthUnchecked",
            shouldSkipCasting: true,
            findThreshold: (opt) => opt.hp ?? 40,
        });
    }

    /** A mana step (Life Tap) while the player's mana is hidden. */
    findHiddenMana(): HiddenCue | undefined {
        if (!this.health.isManaHidden()) return undefined;
        return this.pick(this.lists.getRotation(), {
            doesWant: (opt) => opt.manaMax !== undefined,
            gate: "isManaUnchecked",
            findThreshold: (opt) => opt.manaMax,
        });
    }

    /** A defensive step on the player's own health while it is hidden. */
    findHiddenDefense(): HiddenCue | undefined {
        if (!this.health.isHealthHidden("player")) return undefined;
        return this.pick(this.lists.getDefense(), {
            doesWant: (opt) => opt.hp !== undefined && (opt.unit === undefined || opt.unit === "player"),
            gate: "isHealthUnchecked",
            findThreshold: (opt, id) =>
                opt.isHeal === true ? this.health.getAutoHealThreshold(id, "player", opt.hp ?? 50) : (opt.hp ?? 50),
        });
    }

    private pick(steps: Step[], rule: PickRule): HiddenCue | undefined {
        for (const step of steps) {
            if (!step.isOn || !rule.doesWant(step.opt) || (rule.shouldSkipCasting === true && this.castState.isCasting(step.id))) continue;
            const opt: StepOptions = { ...step.opt, [rule.gate]: true };
            if (rule.clear !== undefined) opt[rule.clear] = undefined;
            if (!this.steps.isStepOffered(step.id, opt, 0.2)) continue;
            const threshold = rule.findThreshold(step.opt, step.id);
            if (threshold !== undefined) return { spellId: this.spells.resolveOrSame(step.id), threshold };
        }
        return undefined;
    }
}
