// The page of this addon in the Settings panel, per character.
import type { AboutSection, ControlsService, OptionsPage } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";

export class RemindersPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly about: AboutSection,
    ) {}

    buildPage(category: SettingsCategory, layout: SettingsLayout): void {
        this.controls.addHeader(layout, this.locale.getText("HDR_CHARACTER"));
        this.controls.addSwitchCheckbox(category, "isMuted", this.locale.getText("OPT_MUTE"), this.locale.getText("TIP_MUTE"));
        this.controls.addSwitchCheckbox(
            category,
            "hideResting",
            this.locale.getText("OPT_HIDE_RESTING"),
            this.locale.getText("TIP_HIDE_RESTING"),
        );
        this.controls.addSoundDropdown(
            category,
            "sound",
            this.locale.getText("OPT_SOUND"),
            this.locale.getText("TIP_SOUND"),
            () => this.settings.get("sound"),
            (sound) => this.settings.change("sound", sound),
        );
        this.about.addAboutSection(layout);
    }
}
