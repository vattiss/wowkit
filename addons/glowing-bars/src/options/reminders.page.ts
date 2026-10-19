// The Reminders page: what the addon reminds about, per character.

import type { AddonLocale } from "../locale/locale.interface";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { AddonSettingsService, AddonSettings } from "../settings/settings.interface";
import type { SpellsService } from "@wowkit/wow";
import type { AboutSection, ControlsService, OptionsPage, WidgetsService } from "@wowkit/ui";
import type { GlowsSection } from "./glows.section";
import type { StyleTableService } from "./style-table.service";
import type { ReagentsSection } from "./reagents.section";
import type { ReminderControlsService } from "./reminder-controls.service";
import type { WeaponSection } from "./weapon.section";

export class RemindersPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly classBuffs: ClassBuffsService,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
        private readonly weaponSection: WeaponSection,
        private readonly reagentsSection: ReagentsSection,
        private readonly glowsSection: GlowsSection,
        private readonly about: AboutSection,
        private readonly widgets: WidgetsService,
        private readonly table: StyleTableService,
    ) {}

    buildPage(category: SettingsCategory, layout: SettingsLayout): void {
        const buffs = this.classBuffs.getClassBuffs();

        this.reminderControls.addHeader(layout, "HDR_LOOKS");
        this.widgets.addButton(
            layout,
            this.locale.getText("OPT_TABLE"),
            this.locale.getText("BTN_OPEN"),
            () => this.table.toggle(),
            this.locale.getText("TIP_TABLE"),
        );

        this.reminderControls.addHeader(layout, "HDR_CHARACTER");
        this.controls.addCheckbox(
            category,
            "isMuted",
            this.locale.getText("OPT_MUTE"),
            this.locale.getText("TIP_MUTE"),
            false,
            () => this.settings.get("isMuted"),
            (isChecked) => this.settings.change("isMuted", isChecked),
        );
        this.reminderControls.addSwitch(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");

        if (buffs.length > 0) {
            this.reminderControls.addHeader(layout, "HDR_BUFFS");
            this.reminderControls.addSwitch(category, "showBuff", "OPT_BUFF", "TIP_BUFF");
            this.addBuffCheckboxes(category);
            if (buffs.some((classBuff) => classBuff.party !== undefined)) {
                this.reminderControls.addSwitch(category, "showPartyBuffs", "OPT_PARTY_BUFFS", "TIP_PARTY_BUFFS");
            }
        }

        this.weaponSection.addWeaponSection(category, layout);
        this.glowsSection.addGlowsSection(category, layout);

        this.reminderControls.addHeader(layout, "HDR_RANKS");
        this.reminderControls.addSwitch(category, "showRanks", "OPT_RANKS", "TIP_RANKS");

        this.reagentsSection.addReagentsSection(category, layout);

        this.about.addAboutSection(layout);
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
