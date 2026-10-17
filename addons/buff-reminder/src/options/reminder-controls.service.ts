// The controls every reminder has on the Reminders page, in this addon's words: a switch, and the sound and the
// glow color of a reminder. Built on the generic controls of @wowkit/ui.
import type { ControlsService } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { getGlowColor } from "../settings/settings.colors";
import { COLOR_DEFAULTS } from "../settings/settings.constants";
import type { AddonSettings, AddonSettingsService, ColorKey } from "../settings/settings.interface";

type FeatureKey = "hideResting" | "showBuff" | "showWeapon" | "showPartyBuffs" | "showBarNotice";

export class ReminderControlsService {
    constructor(
        private readonly controls: ControlsService<AddonSettings>,
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
    ) {}

    addHeader(layout: SettingsLayout, label: TextKey): void {
        this.controls.addHeader(layout, this.locale.getText(label));
    }

    /** A switch of a feature, on by default. */
    addSwitch(category: SettingsCategory, key: FeatureKey, label: TextKey, tooltip: TextKey): void {
        this.controls.addSwitchCheckbox(category, key, this.locale.getText(label), this.locale.getText(tooltip));
    }

    /** The sound and the glow color of a reminder. */
    addSoundAndColor(category: SettingsCategory, soundKey: "soundBuff" | "soundWeapon", colorKey: ColorKey, colorLabel: TextKey): void {
        this.controls.addSoundDropdown(
            category,
            soundKey,
            this.locale.getText("OPT_SOUND"),
            this.locale.getText("TIP_SOUND"),
            () => this.settings.get(soundKey),
            (sound) => this.settings.change(soundKey, sound),
        );
        this.controls.addColorSwatch(
            category,
            colorKey,
            this.locale.getText(colorLabel),
            COLOR_DEFAULTS[colorKey],
            () => getGlowColor(this.settings, colorKey),
            (color) => this.settings.change("colors", { ...this.settings.get("colors"), [colorKey]: color }),
        );
    }
}
