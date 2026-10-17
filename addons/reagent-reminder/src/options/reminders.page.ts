// The page of this addon in the Settings panel: the switch, the sound, and a switch for each reagent of the player's class.
import type { AboutSection, ControlsService, OptionsPage } from "@wowkit/ui";
import type { PlayerService, Reagent, ReagentsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";

export class RemindersPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reagents: ReagentsService,
        private readonly player: PlayerService,
        private readonly about: AboutSection,
    ) {}

    buildPage(category: SettingsCategory, layout: SettingsLayout): void {
        this.controls.addHeader(layout, this.locale.getText("HDR_CHARACTER"));
        this.controls.addCheckbox(
            category,
            "isMuted",
            this.locale.getText("OPT_MUTE"),
            this.locale.getText("TIP_MUTE"),
            false,
            () => this.settings.get("isMuted"),
            (isChecked) => this.settings.change("isMuted", isChecked),
        );
        this.controls.addSoundDropdown(
            category,
            "sound",
            this.locale.getText("OPT_SOUND"),
            this.locale.getText("TIP_SOUND"),
            () => this.settings.get("sound"),
            (sound) => this.settings.change("sound", sound),
        );
        this.addReagentCheckboxes(category, layout);
        this.about.addAboutSection(layout);
    }

    /** One checkbox per reagent of the player's class, labeled with the item's name; a class without reagents gets none. */
    private addReagentCheckboxes(category: SettingsCategory, layout: SettingsLayout): void {
        const reagents = this.reagents.getReagentsOfClass(this.player.getClassToken());
        if (reagents.length === 0) return;
        this.controls.addHeader(layout, this.locale.getText("HDR_REAGENTS"));
        for (const reagent of reagents) {
            this.controls.addCheckbox(
                category,
                `reagent_${reagent.itemId}`,
                this.reagents.getReagentName(reagent),
                this.locale.getText("TIP_REAGENT_ONE"),
                true,
                () => this.isReagentOn(reagent),
                (isChecked) => this.setReagentOn(reagent, isChecked),
            );
        }
    }

    private isReagentOn(reagent: Reagent): boolean {
        return this.settings.get("reagentOn")[String(reagent.itemId)] !== false;
    }

    /** Switches one reagent on or off; the default (on) is not stored. */
    private setReagentOn(reagent: Reagent, isOn: boolean): void {
        const reagentOn = { ...this.settings.get("reagentOn") };
        reagentOn[String(reagent.itemId)] = isOn ? undefined : false;
        this.settings.change("reagentOn", reagentOn);
    }
}
