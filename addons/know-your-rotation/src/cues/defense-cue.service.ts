// The defense cue: a defensive cooldown when the player's health is low (Shield Wall, Divine Protection, Ice Block).
import type { ActionBarsService, SpellsService } from "@wowkit/wow";
import type { ListsService } from "../situation/lists.service";
import type { RoleService } from "../situation/role.service";
import type { StepService } from "../steps/step.service";

export class DefenseCueService {
    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly lists: ListsService,
        private readonly role: RoleService,
        private readonly steps: StepService,
    ) {}

    /**
     * Health-based cooldowns first (Shield Wall at 20%), then the rest, each in list order. A spell on no button cannot
     * glow, so the first one that is on a bar goes first; when none is, the first stays.
     */
    findDefense(): number | undefined {
        let fallback: number | undefined;
        for (const isUrgentPass of [true, false]) {
            for (const step of this.lists.getDefense()) {
                if ((step.opt.hp !== undefined) !== isUrgentPass || !step.isOn) continue;
                if (step.opt.role !== undefined && step.opt.role !== this.role.getRole()) continue;
                if (!this.steps.isStepOffered(step.id, step.opt)) continue;
                const id = this.spells.resolveOrSame(step.id);
                if (this.actionBars.isOnBars(id)) return id;
                fallback = fallback ?? id;
            }
        }
        return fallback;
    }
}
