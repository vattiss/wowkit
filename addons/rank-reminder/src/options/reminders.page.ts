// The Reminders page: what this addon does, per character.
import type { ControlsService, OptionsPage } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings } from "../settings/settings.interface";

export class RemindersPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly controls: ControlsService<AddonSettings>,
    ) {}

    registerPage(root: SettingsCategory | undefined): SettingsCategory {
        if (root === undefined) throw new Error("the reminders page goes under the home page");
        const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, this.locale.getText("TAB_REMINDERS"));
        this.controls.addHeader(layout, this.locale.getText("HDR_CHARACTER"));
        this.controls.addSwitchCheckbox(category, "isMuted", this.locale.getText("OPT_MUTE"), this.locale.getText("TIP_MUTE"));
        this.controls.addSwitchCheckbox(
            category,
            "hideResting",
            this.locale.getText("OPT_HIDE_RESTING"),
            this.locale.getText("TIP_HIDE_RESTING"),
        );
        return category;
    }
}
