// How the addon may use Blizzard's Cooldown Manager, and which of its windows show. With an addon that runs the manager's windows
// itself, showing them is that addon's business.
import type { ControlsService, MessagesService, WidgetsService, OptionsTab, OptionRow } from "@wowkit/ui";
import { COOLDOWN_WINDOWS, hasHiddenWindows, repairHiddenWindows, type CooldownViewerService, type PlayerService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { WINDOW_ICONS_SETTINGS } from "../settings/settings.constants";
import type { AddonSettings, AddonSettingsService, CooldownManagerAccess, CooldownManagerIcons } from "../settings/settings.interface";
import { WINDOW_TEXTS } from "./cooldown-windows.constants";
import type { ReminderControlsService } from "./reminder-controls.service";

const ACCESS_CHOICES: [value: CooldownManagerAccess, label: TextKey][] = [
    ["full", "OPT_MANAGER_ACCESS_FULL"],
    ["readOnly", "OPT_MANAGER_ACCESS_READ"],
    ["off", "OPT_MANAGER_ACCESS_OFF"],
];
/** The choices of the Welcome tab, each with what it means. */
const WELCOME_CHOICES: [value: CooldownManagerAccess, label: TextKey, meaning: TextKey][] = [
    ["full", "CHOICE_FULL", "CHOICE_FULL_TEXT"],
    ["readOnly", "OPT_MANAGER_ACCESS_READ", "CHOICE_READ_TEXT"],
    ["off", "OPT_MANAGER_ACCESS_OFF", "CHOICE_OFF_TEXT"],
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
        private readonly widgets: WidgetsService,
        private readonly player: PlayerService,
        private readonly messages: MessagesService,
    ) {}

    addCooldownManagerSection(tab: OptionsTab): void {
        this.reminderControls.addHeader(tab, "HDR_COOLDOWN_MANAGER");
        if (!this.viewer.isRunByOtherAddon()) tab.addText(() => this.locale.getText("CHOICE_WINDOWS_TEXT"), "GameFontNormalSmall");
        this.addChoice(tab, "cooldownManagerAccess", this.locale.getText("OPT_MANAGER_ACCESS"), "TIP_MANAGER_ACCESS", ACCESS_CHOICES);
        // Right under the choice it is for, always there: a change of it works from the next load of the interface
        this.widgets.addButton(
            tab,
            this.locale.getText("OPT_CHOICE_RELOAD"),
            this.locale.getText("BTN_RELOAD"),
            () => C_UI.Reload(),
            this.locale.getText("TIP_MANAGER_RELOAD"),
        );
        const isRunByOther = this.viewer.isRunByOtherAddon();
        for (const window of COOLDOWN_WINDOWS) {
            const label = string.format(
                this.locale.getText(isRunByOther ? "OPT_MANAGER_ICONS_OTHER" : "OPT_MANAGER_ICONS"),
                this.locale.getText(WINDOW_TEXTS[window]),
            );
            const icons = this.addChoice(tab, WINDOW_ICONS_SETTINGS[window], label, "TIP_MANAGER_ICONS", ICON_CHOICES);
            icons.enableWhen(() => !isRunByOther && this.settings.get("cooldownManagerAccess") !== "off");
        }
        // EllesmereUI's module sets the windows to show by itself
        if (!isRunByOther) {
            this.widgets
                .addButton(
                    tab,
                    this.locale.getText("OPT_MANAGER_REPAIR"),
                    this.locale.getText("BTN_REPAIR"),
                    () => this.repairWindows(),
                    this.locale.getText("TIP_MANAGER_REPAIR"),
                )
                .showWhen(() => hasHiddenWindows());
        }
        // At the end of the tab; the settings window stays open beside it
        this.widgets
            .addWideButton(tab, this.locale.getText("BTN_OPEN_MANAGER"), () => this.viewer.openSettingsWindow())
            .showWhen(() => this.viewer.hasSettingsWindow());
    }

    /** The choice of the Welcome tab: how far the addon may go, the windows, and the reload it all needs. */
    addWelcomeChoice(tab: OptionsTab): void {
        tab.addText(() => this.locale.getText("CHOICE_INTRO"));
        for (const [value, label, meaning] of WELCOME_CHOICES) {
            this.controls.addChoice(
                tab,
                `welcome_access_${value}`,
                this.locale.getText(label),
                this.locale.getText(meaning),
                value === "full",
                () => this.settings.get("cooldownManagerAccess") === value,
                (isChecked) => {
                    if (isChecked) this.chooseAccess(value);
                },
            );
        }
        if (this.viewer.isRunByOtherAddon()) tab.addText(() => this.locale.getText("CHOICE_ELLESMERE_TEXT"), "GameFontNormalSmall");
        else tab.addText(() => this.locale.getText("WELCOME_WINDOWS_TEXT"), "GameFontNormalSmall");
        this.widgets.addButton(
            tab,
            this.locale.getText("OPT_CHOICE_RELOAD"),
            this.locale.getText("BTN_RELOAD"),
            () => C_UI.Reload(),
            this.locale.getText("TIP_MANAGER_RELOAD"),
        );
    }

    /** Picked on the Welcome tab: it counts at once, and works from the next load of the interface. */
    private chooseAccess(value: CooldownManagerAccess): void {
        this.settings.change("cooldownManagerAccess", value);
    }

    /** A saved layout takes effect at the next load of the interface. */
    private repairWindows(): void {
        if (this.player.isInCombat()) {
            this.messages.say(this.locale.getText("MSG_REPAIR_IN_COMBAT"));
            return;
        }
        const count = repairHiddenWindows();
        if (count === undefined) this.messages.say(this.locale.getText("MSG_REPAIR_FAILED"));
        else if (count === 0) this.messages.say(this.locale.getText("MSG_REPAIR_NONE"));
        else C_UI.Reload();
    }

    private addChoice<K extends "cooldownManagerAccess" | (typeof WINDOW_ICONS_SETTINGS)[keyof typeof WINDOW_ICONS_SETTINGS]>(
        tab: OptionsTab,
        key: K,
        label: string,
        tooltip: TextKey,
        choices: [value: AddonSettings[K], label: TextKey][],
    ): OptionRow {
        return this.controls.addDropdown(
            tab,
            key,
            label,
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
