// The buffs, weapon buffs and group buffs with a reagent that the player added by their ID. The addon knows nothing more of
// them than the spell, so each is reminded of in the simplest way that fits its kind: a buff when the player has no aura
// of its name, a weapon buff when the main hand has no temporary enchant at all, a reagent when the item the spell's
// tooltip names as its reagent runs low.
import type { ActionBarsService, BagsService, SpellsService, WeaponEnchantsService } from "@wowkit/wow";
import type { BuffStateService } from "../character/buff-state.service";
import type { CustomCuesService } from "../glows/custom-cues.service";
import type { ReagentsService } from "../reagents/reagents.service";
import type { AddonSettingsService, CueKind } from "../settings/settings.interface";

export class CustomRemindersService {
    constructor(
        private readonly customCues: CustomCuesService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly buffState: BuffStateService,
        private readonly weaponEnchants: WeaponEnchantsService,
        private readonly bags: BagsService,
        private readonly settings: AddonSettingsService,
        private readonly reagents: ReagentsService,
    ) {}

    /** The added buffs that are on a button and not on the player (in combat a cast one counts until the fight ends). */
    findMissingBuffs(): number[] {
        return this.listOnBars("buff").filter((id) => !this.buffState.hasAura(id));
    }

    /** The added weapon buffs, when the main-hand weapon has no temporary enchant (poison, imbue or stone) at all. */
    findWeaponSpells(): number[] {
        const spellIds = this.listOnBars("weapon");
        if (spellIds.length === 0) return [];
        return this.weaponEnchants.getWeaponEnchant(false).has === false ? spellIds : [];
    }

    /** The added spells whose reagent, named in the spell's tooltip, runs low in the bags. */
    findReagentSpells(): number[] {
        return this.listOnBars("reagent").filter((id) => {
            const reagent = this.reagents.findTooltipReagent(id);
            return reagent !== undefined && this.reagents.isLow(this.bags.getItemCountByName(reagent));
        });
    }

    /** The added spells of a kind that are switched on, learned and on a button, as the IDs the buttons hold. */
    private listOnBars(kind: CueKind): number[] {
        const found: number[] = [];
        const glowOn = this.settings.get("glowOn");
        for (const id of this.customCues.listCustom(kind)) {
            if (glowOn[string.format("%d", id)] === false) continue;
            const learned = this.spells.resolve(id) ?? id;
            if (this.actionBars.isOnBars(learned)) found.push(learned);
        }
        return found;
    }
}
