// The cues against the enemy target, next to the rotation: the interrupt, the purge, and the hunter's shots.
import type { AurasService, SpellsService, UnitsService } from "@wowkit/wow";
import { Hunter } from "@wowkit/wow-data";
import { INTERRUPTS, PURGES } from "../knowledge/class-data.constants";
import type { StepOptions } from "../knowledge/step.interface";
import type { RangeService } from "../situation/range.service";
import type { RoleService } from "../situation/role.service";
import type { TargetService } from "../situation/target.service";
import type { StepService } from "../steps/step.service";

/** Auto Shot while it is off and the target is at range; Concussive Shot while the target at range is not slowed. */
const SHOT_CUES: { id: number; opt: StepOptions }[] = [
    { id: Hunter.AutoShot, opt: { isAutoRepeat: true, isAttack: true, notInMelee: true } },
    { id: Hunter.ConcussiveShot, opt: { isAttack: true, notInMelee: true, keepsDebuff: true } },
];

export class EnemyCuesService {
    constructor(
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly auras: AurasService,
        private readonly steps: StepService,
        private readonly range: RangeService,
        private readonly role: RoleService,
        private readonly target: TargetService,
    ) {}

    /** The interrupt while the enemy target casts something that can be interrupted. */
    findInterrupt(): number | undefined {
        const id = INTERRUPTS[this.role.getClassToken()];
        if (id === undefined || !this.isReadyAgainstEnemy(id)) return undefined;
        const cast = this.units.readCast("target");
        return cast.isCasting && !cast.isShielded ? id : undefined;
    }

    /** The purge while the enemy target has a magic effect (or one that can be stolen). */
    findPurge(): number | undefined {
        const id = PURGES[this.role.getClassToken()];
        if (id === undefined || !this.isReadyAgainstEnemy(id)) return undefined;
        const auras = this.auras.scanAuras("target", "HELPFUL").auras;
        return auras.some((aura) => aura.isStealable || aura.dispelType === "Magic") ? id : undefined;
    }

    /** The hunter's shots: never in the place of a rotation spell, and not where the client says the target is out of range. */
    findShots(): number[] {
        if (this.role.getClassToken() !== "HUNTER") return [];
        const due: number[] = [];
        for (const cue of SHOT_CUES) {
            const id = this.spells.resolveOrSame(cue.id);
            if (this.steps.isStepOffered(cue.id, cue.opt) && !this.range.doesClientSayOutOfRange(id)) due.push(id);
        }
        return due;
    }

    /** Ready, an enemy targeted, and the target not out of the spell's range. */
    private isReadyAgainstEnemy(id: number): boolean {
        if (!this.steps.isReady(id) || !this.target.isHostile()) return false;
        return this.range.getRangeState(id, { isAttack: true }) !== "out";
    }
}
