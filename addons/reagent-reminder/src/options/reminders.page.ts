// The Reminders page: the one switch of this addon, per character.
import type { ControlsService, OptionsPage } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";

export class RemindersPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
    ) {}

    registerPage(root: SettingsCategory | undefined): SettingsCategory {
        if (root === undefined) throw new Error("the reminders page goes under the home page");
        const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, this.locale.getText("TAB_REMINDERS"));
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
        return category;
    }
}
