// The controls every reminder has on the Reminders page, in this addon's words: a switch. Built on the generic controls
// of @wowkit/ui. The look of a reminder (color, opacity, message, sound) is the table's.
import type { ControlsService } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettings } from "../settings/settings.interface";

type FeatureKey =
    | "hideResting"
    | "showBuff"
    | "showWeapon"
    | "showPartyBuffs"
    | "showRanks"
    | "showReagents"
    | "showCooldowns"
    | "showCooldownsOutOfCombat"
    | "showCooldownsAtFightStart"
    | "showProcs";

export class ReminderControlsService {
    constructor(
        private readonly controls: ControlsService<AddonSettings>,
        private readonly locale: AddonLocale,
    ) {}

    addHeader(layout: SettingsLayout, label: TextKey): void {
        this.controls.addHeader(layout, this.locale.getText(label));
    }

    /** A switch of a feature, on by default. */
    addSwitch(category: SettingsCategory, key: FeatureKey, label: TextKey, tooltip: TextKey): void {
        this.controls.addSwitchCheckbox(category, key, this.locale.getText(label), this.locale.getText(tooltip));
    }
}
