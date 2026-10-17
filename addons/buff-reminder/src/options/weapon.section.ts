// The weapon buff part of the Reminders page: the switch, which buff to keep up (one per hand for
// classes that coat both weapons), the sound and the color.

import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { WeaponChoiceService } from "../reminders/weapon/weapon-choice.service";
import type { AddonSettingsService, AddonSettings } from "../settings/settings.interface";
import type { SpellsService } from "@wowkit/wow";
import type { ControlsService } from "@wowkit/ui";
import type { ReminderControlsService } from "./reminder-controls.service";

export class WeaponSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly weaponChoice: WeaponChoiceService,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
    ) {}

    /** Nothing is added for a class without weapon buffs. */
    addWeaponSection(category: SettingsCategory, layout: SettingsLayout): void {
        if (this.weaponChoice.getWeaponChoices().length === 0) return;
        this.reminderControls.addHeader(layout, "HDR_WEAPON");
        this.reminderControls.addSwitch(category, "showWeapon", "OPT_WEAPON", "TIP_WEAPON");
        if (this.weaponChoice.hasOffhandChoice()) {
            this.addWeaponPick(category, "weaponBuff", "OPT_WEAPON_PICK_MAIN", false);
            this.addWeaponPick(category, "weaponBuffOff", "OPT_WEAPON_PICK_OFF", true);
        } else {
            this.addWeaponPick(category, "weaponBuff", "OPT_WEAPON_PICK", false);
        }
        this.reminderControls.addSoundAndColor(category, "soundWeapon", "weapon", "OPT_COLOR_WEAPON");
    }

    /** The pick of the weapon buff: "auto" (the best one learned) or one of the learned buffs. */
    private addWeaponPick(category: SettingsCategory, key: "weaponBuff" | "weaponBuffOff", label: TextKey, isOffhand: boolean): void {
        this.controls.addDropdown(
            category,
            key,
            this.locale.getText(label),
            this.locale.getText("TIP_WEAPON_PICK"),
            "auto",
            () => {
                const picked = this.weaponChoice.getWeaponChoices().find((entry) => entry.key === this.settings.get(key));
                return picked && this.weaponChoice.isWeaponBuffLearned(picked) ? picked.key : "auto";
            },
            (value) => this.settings.change(key, value !== "auto" ? value : undefined),
            () => {
                const auto = this.weaponChoice.findAutomaticWeaponBuff(isOffhand);
                const autoLabel = auto
                    ? `${this.locale.getText("OPT_AUTOMATIC")} (${auto.entry.name ?? this.spells.getSpellLabel(auto.entry.id) ?? auto.entry.key})`
                    : this.locale.getText("OPT_AUTOMATIC");
                const list: [string, string][] = [["auto", autoLabel]];
                for (const entry of this.weaponChoice.getWeaponChoices()) {
                    if (this.weaponChoice.isWeaponBuffLearned(entry)) {
                        list.push([entry.key, entry.name ?? this.spells.getSpellLabel(entry.id) ?? entry.key]);
                    }
                }
                return list;
            },
        );
    }
}
