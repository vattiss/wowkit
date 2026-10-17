// The Reminders page: what the addon reminds about, per character.

import type { LocaleService } from "../locale/locale.service";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { SettingsService } from "../settings/settings.service";
import type { SpellsService } from "@forever/wow";
import type { ControlsService } from "./controls.service";
import type { WeaponSection } from "./weapon.section";

export class RemindersPage {
    constructor(
        private readonly locale: LocaleService,
        private readonly spells: SpellsService,
        private readonly classBuffs: ClassBuffsService,
        private readonly settings: SettingsService,
        private readonly controls: ControlsService,
        private readonly weaponSection: WeaponSection,
    ) {}

    registerRemindersPage(root: SettingsCategory): void {
        const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, this.locale.getText("TAB_REMINDERS"));
        const buffs = this.classBuffs.getClassBuffs();

        this.controls.addHeader(layout, "HDR_CHARACTER");
        this.controls.addCheckbox(
            category,
            "isMuted",
            this.locale.getText("OPT_MUTE"),
            this.locale.getText("TIP_MUTE"),
            false,
            () => this.settings.get("isMuted"),
            (isChecked) => this.settings.change("isMuted", isChecked),
        );
        this.controls.addFeatureCheckbox(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");

        if (buffs.length > 0) {
            this.controls.addHeader(layout, "HDR_BUFFS");
            this.controls.addFeatureCheckbox(category, "showBuff", "OPT_BUFF", "TIP_BUFF");
            this.addBuffCheckboxes(category);
            if (buffs.some((classBuff) => classBuff.party !== undefined)) {
                this.controls.addFeatureCheckbox(category, "showPartyBuffs", "OPT_PARTY_BUFFS", "TIP_PARTY_BUFFS");
            }
            this.controls.addSoundDropdown(category, "soundBuff");
            this.controls.addColorSwatch(category, "buff", "OPT_COLOR_BUFF");
        }

        this.weaponSection.addWeaponSection(category, layout);

        this.controls.addHeader(layout, "HDR_MESSAGES");
        this.controls.addFeatureCheckbox(category, "showBarNotice", "OPT_BAR_NOTICE", "TIP_BAR_NOTICE");
        this.controls.addFeatureCheckbox(category, "showRankNotice", "OPT_RANK_NOTICE", "TIP_RANK_NOTICE");
        if (buffs.some((classBuff) => classBuff.party?.groupIds !== undefined)) {
            this.controls.addFeatureCheckbox(category, "showReagentNotice", "OPT_REAGENT_NOTICE", "TIP_REAGENT_NOTICE");
        }

        this.controls.addHeader(layout, "HDR_DEBUG");
        this.controls.addCheckbox(
            category,
            "isDebugMode",
            this.locale.getText("OPT_DEBUG"),
            this.locale.getText("TIP_DEBUG"),
            false,
            () => this.settings.get("isDebugMode"),
            (isChecked) => this.settings.change("isDebugMode", isChecked),
        );
    }

    /** One checkbox per buff of the class list, labeled with the spell's name. */
    private addBuffCheckboxes(category: SettingsCategory): void {
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            this.controls.addCheckbox(
                category,
                `buff_${classBuff.key}`,
                this.spells.getSpellLabel(classBuff.id) ?? classBuff.key,
                this.locale.getText("TIP_BUFF_ONE"),
                classBuff.isOnByDefault,
                () => this.classBuffs.isBuffEnabled(classBuff),
                (isChecked) => this.classBuffs.setBuffEnabled(classBuff, isChecked),
            );
        }
    }
}
