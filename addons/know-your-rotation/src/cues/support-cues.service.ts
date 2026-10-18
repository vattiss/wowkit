// The cues that look after the player and the group: the cleanse, and the shaman's totems.
import type { AurasService, SpellsService, TotemsService, UnitsService } from "@wowkit/wow";
import { CURES } from "../knowledge/class-data.constants";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { StepOptions } from "../knowledge/step.interface";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { RoleService } from "../situation/role.service";
import type { StepService } from "../steps/step.service";

/** What a totem needs before it is worth dropping, by when it helps. */
const TOTEM_OPTIONS: { [when: string]: StepOptions | undefined } = {
    pull: { isTotem: true, isFightOnly: true },
    hostile: { isTotem: true, isAttack: true },
    melee: { isTotem: true, isInMeleeOnly: true },
};
/** Who else the cleanse is for, with the option on. */
const CLEANSE_UNITS: UnitToken[] = ["mouseover", "target", "focus", "party1", "party2", "party3", "party4"];

export class SupportCuesService {
    constructor(
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly auras: AurasService,
        private readonly totems: TotemsService,
        private readonly traits: SpellTraitsService,
        private readonly steps: StepService,
        private readonly role: RoleService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** The first cure that is learned and ready for a debuff on the player (or the group, with the option on). */
    findCleanse(): number | undefined {
        const units: UnitToken[] = ["player", ...(this.settings.get("showGroupCleanse") ? CLEANSE_UNITS : [])];
        for (const cure of CURES[this.role.getClassToken()] ?? []) {
            if (!this.spells.isLearned(cure.id) || !this.steps.isReady(cure.id)) continue;
            if (units.some((unit) => this.hasDebuffOf(unit, cure.types))) return cure.id;
        }
        return undefined;
    }

    /** Every totem of the totem bar that is missing and worth dropping now (they sit in different slots: all glow). */
    findTotems(): number[] {
        return this.totems.listTotemBarSpells().filter((id) => {
            const when = this.traits.findTotem(id)?.when;
            const opt = when !== undefined ? TOTEM_OPTIONS[when] : undefined;
            return opt !== undefined && this.steps.isStepOffered(id, opt);
        });
    }

    private hasDebuffOf(unit: UnitToken, types: string[]): boolean {
        if (unit !== "player" && !this.units.isFriend(unit)) return false;
        return this.auras.scanAuras(unit, "HARMFUL").auras.some((aura) => aura.dispelType !== undefined && types.includes(aura.dispelType));
    }
}
