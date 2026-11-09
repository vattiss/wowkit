// How the addon may use Blizzard's Cooldown Manager, and whether its icons show. With an addon that runs the manager's windows
// itself, showing them is that addon's business.
import type { ControlsService } from "@wowkit/ui";
import type { CooldownViewerService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettings, AddonSettingsService, CooldownManagerAccess, CooldownManagerIcons } from "../settings/settings.interface";
import type { ReminderControlsService } from "./reminder-controls.service";

const ACCESS_CHOICES: [value: CooldownManagerAccess, label: TextKey][] = [
    ["full", "OPT_MANAGER_ACCESS_FULL"],
    ["readOnly", "OPT_MANAGER_ACCESS_READ"],
    ["off", "OPT_MANAGER_ACCESS_OFF"],
];
const ICON_CHOICES: [value: CooldownManagerIcons, label: TextKey][] = [
    ["hide", "OPT_MANAGER_ICONS_HIDE"],
    ["show", "OPT_MANAGER_ICONS_SHOW"],
];

export class CooldownManagerSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
        private readonly viewer: CooldownViewerService,
    ) {}

    addCooldownManagerSection(category: SettingsCategory, layout: SettingsLayout): void {
        this.reminderControls.addHeader(layout, "HDR_COOLDOWN_MANAGER");
        const access = this.addChoice(category, "cooldownManagerAccess", "OPT_MANAGER_ACCESS", "TIP_MANAGER_ACCESS", ACCESS_CHOICES);
        const iconsLabel = this.viewer.isRunByOtherAddon() ? "OPT_MANAGER_ICONS_OTHER" : "OPT_MANAGER_ICONS";
        const icons = this.addChoice(category, "cooldownManagerIcons", iconsLabel, "TIP_MANAGER_ICONS", ICON_CHOICES);
        icons.SetParentInitializer(access, () => !this.viewer.isRunByOtherAddon() && this.settings.get("cooldownManagerAccess") !== "off");
    }

    private addChoice<K extends "cooldownManagerAccess" | "cooldownManagerIcons">(
        category: SettingsCategory,
        key: K,
        label: TextKey,
        tooltip: TextKey,
        choices: [value: AddonSettings[K], label: TextKey][],
    ): SettingsInitializer {
        return this.controls.addDropdown(
            category,
            key,
            this.locale.getText(label),
            this.locale.getText(tooltip),
            this.settings.getDefault(key),
            () => this.settings.get(key),
            (value) =>
                this.settings.change(
                    key,
                    choices.some(([choice]) => choice === value) ? (value as AddonSettings[K]) : this.settings.getDefault(key),
                ),
            () => choices.map(([value, text]): [string, string] => [value, this.locale.getText(text)]),
            true,
        );
    }
}
