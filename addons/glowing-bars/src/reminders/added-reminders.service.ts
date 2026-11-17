// The buffs, weapon buffs and group buffs with a reagent that the player added by their ID. The addon knows nothing more of
// them than the spell, so each is reminded of in the simplest way that fits its type: a buff when the player has no aura
// of its name (a food or drink: see FedBuffsService), a weapon buff when its weapon has no temporary enchant (a stone, an oil:
// the imbue of a class, a poison or a Firestone, is a place of its own beside it), a reagent when the item the spell's
// tooltip names as its reagent runs low.
import type { LowReagent } from "../reagents/reagent.interface";
import {
    type ActionBarsService,
    type BagsService,
    type PlayerService,
    type SpellsService,
    type WeaponEnchantsService,
    OFF_HAND_SLOT,
    findItemUseSpell,
    isOutOfItem,
} from "@wowkit/wow";
import type { BuffStateService } from "../character/buff-state.service";
import type { AddedSpellsService } from "../glows/added-spells.service";
import { findReagentRowEntry, type ReagentsService } from "../reagents/reagents.service";
import type { AddonSettingsService, AddableType } from "../settings/settings.interface";
import type { FedBuffsService } from "./fed-buffs.service";
import type { CoveredWeaponButton } from "./reminders.interface";
import type { StyleService } from "../settings/style.service";
import { isAboutToExpire } from "./weapon/weapon-reactions";
import { BUFF_GIVEN_BY_ITEM, BUFF_GIVEN_BY_SPELL } from "./given-buffs.constants";
import type { BouncedBuffsService } from "../character/bounced-buffs.service";

export class AddedRemindersService {
    private styles: StyleService | undefined;

    constructor(
        private readonly addedSpells: AddedSpellsService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly buffState: BuffStateService,
        private readonly weaponEnchants: WeaponEnchantsService,
        private readonly bags: BagsService,
        private readonly settings: AddonSettingsService,
        private readonly reagents: ReagentsService,
        private readonly fedBuffs: FedBuffsService,
        private readonly player: PlayerService,
        private readonly bounced: BouncedBuffsService,
    ) {}

    /** The added buffs that are on a button and not on the player (in combat a cast one counts until the fight ends). */
    findMissingBuffs(): number[] {
        const ids = this.listOnBars("missingBuff");
        if (ids.length === 0) return ids;
        const missingFed = this.fedBuffs.findMissing(ids.filter((id) => this.fedBuffs.isFedSpell(id)));
        return ids.filter((id) =>
            this.fedBuffs.isFedSpell(id)
                ? missingFed.includes(id)
                : !this.buffState.hasAura(this.findGivenBuff(id), this.findBefore("missingBuff", id)) &&
                  this.spells.isCastable(id) !== false &&
                  !this.bounced.isBounced(id),
        );
    }

    /** The buff to look for: of its own name, unless the spell is known to give one of another name. */
    private findGivenBuff(spellId: number): number {
        const bySpell = BUFF_GIVEN_BY_SPELL.find(([id]) => id === spellId);
        const byItem = BUFF_GIVEN_BY_ITEM.find(([itemId]) => findItemUseSpell(itemId) === spellId);
        return (bySpell ?? byItem)?.[1] ?? spellId;
    }

    /**
     * The added weapon buffs with a button for a weapon whose temporary enchant (a stone, an oil) is missing or about to run
     * out (its row's Before), whatever its imbue.
     */
    findWeaponSpells(): number[] {
        const spellIds = this.listOnBars("weaponBuff");
        if (spellIds.length === 0) return [];
        return spellIds.filter((id) => this.actionBars.findButtonsOf(id).some((button) => this.isButtonForWantingWeapon(button, id)));
    }

    /** The buttons of the added weapon buffs whose weapon has its temporary enchant on, not running out: they stay dark for them. */
    findCoveredButtons(): CoveredWeaponButton[] {
        const covered: CoveredWeaponButton[] = [];
        for (const id of this.listOnBars("weaponBuff")) {
            for (const button of this.actionBars.findButtonsOf(id)) {
                if (!this.isButtonForWantingWeapon(button, id)) covered.push({ button, spellId: id });
            }
        }
        return covered;
    }

    /** Does the weapon of this button want the weapon buff: the one its macro says (/use 16 or /use 17), else either of them? */
    private isButtonForWantingWeapon(button: ActionButton, spellId: number): boolean {
        const handSlot = this.actionBars.findMacroHandSlot(button);
        if (handSlot === undefined) return this.isWeaponWanting(false, spellId) || this.isWeaponWanting(true, spellId);
        return this.isWeaponWanting(handSlot === OFF_HAND_SLOT, spellId);
    }

    /** Has the weapon no temporary enchant, or one about to run out (by the weapon buff's Before)? */
    private isWeaponWanting(isOffhand: boolean, spellId: number): boolean {
        if (isOffhand && !this.player.isOffhandWeaponEquipped()) return false;
        const read = this.weaponEnchants.getWeaponEnchant(isOffhand, "temporary");
        return read.has === false || (read.has === true && isAboutToExpire(read.remain, this.findBefore("weaponBuff", spellId)));
    }

    /** The looks of the rows: how long before a buff or weapon buff runs out it is asked for (its Before). */
    useLooks(styles: StyleService): void {
        this.styles = styles;
    }

    private findBefore(reminderType: "missingBuff" | "weaponBuff", spellId: number): number {
        return this.styles?.findBefore(reminderType, spellId) ?? 0;
    }

    /** The added spells whose reagent, named in the spell's tooltip, runs low in the bags. */
    findReagentSpells(): number[] {
        return this.listOnBars("lowReagent").filter((id) => {
            const reagent = this.reagents.findTooltipReagent(id);
            return reagent !== undefined && this.reagents.isLow(this.bags.getItemCountByName(reagent), findReagentRowEntry(id));
        });
    }

    /** The reagents of the added spells that are learned and switched on, running low, on a bar or not; each reagent once. */
    findLowReagents(): LowReagent[] {
        const low: LowReagent[] = [];
        const enabledSpells = this.settings.get("enabledSpells");
        for (const id of this.addedSpells.listAdded("lowReagent")) {
            const spellId = this.spells.resolve(id);
            const name = this.reagents.findTooltipReagent(id);
            if (spellId === undefined || name === undefined || enabledSpells[string.format("%d", id)] === false) continue;
            const count = this.bags.getItemCountByName(name);
            const isLow = this.reagents.isLow(count, findReagentRowEntry(id));
            if (isLow && !low.some((other) => other.name === name)) low.push({ spellId, name, count });
        }
        return low;
    }

    /** The added spells of a type that are switched on, learned and on a button that has not run out, as the IDs the buttons hold. */
    private listOnBars(reminderType: AddableType): number[] {
        const added = this.addedSpells.listAdded(reminderType);
        // None added as this type: the list itself, empty (nobody changes it)
        if (added.length === 0) return added;
        const found: number[] = [];
        const enabledSpells = this.settings.get("enabledSpells");
        for (const id of added) {
            if (enabledSpells[string.format("%d", id)] === false) continue;
            const learned = this.spells.resolve(id) ?? id;
            const isOnBars = this.fedBuffs.isFedSpell(learned)
                ? this.fedBuffs.isOnBarsWithSome(learned)
                : this.actionBars.findButtonsOf(learned).some((button) => !isOutOfItem(this.actionBars, button));
            if (isOnBars) found.push(learned);
        }
        return found;
    }
}
