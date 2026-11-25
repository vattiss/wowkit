// The Profiles window (issue #76), opened by the button at the top left of the settings: each character
// has a profile of its own, which can take another's settings or the defaults. A copy or a reset takes effect from the next
// load of the interface, as the settings are read then: each asks first, then reloads it; where Forever blocks that, a
// Reload row of its own is there.
import { OnGameEvent } from "@wowkit/core";
import { connectChoiceMenu, type MessagesService, OptionsWindow, type OptionsTab } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import { BASIC_WINDOW_WIDTH, WINDOW_HEIGHT } from "./style-table.constants";
import { COMMAND } from "./table-command";

const BUTTON_WIDTH = 80;
/** Where the controls of a row start, as the settings window's do. */
const CONTROL_LEFT = 340;
/** The start of each control's name, so the window's controls are found by it. */
const VARIABLE_PREFIX = "GlowingBars";

export class ProfilesWindowService {
    private window: OptionsWindow | undefined;
    private tab: OptionsTab | undefined;
    /** Was the profile copied or reset since the interface loaded, so a reload is wanted? */
    private isReloadWaiting = false;

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly messages: MessagesService,
    ) {}

    /** Opens the window (built the first time); not in a fight. */
    open(): void {
        if (InCombatLockdown()) {
            this.messages.say(this.locale.getText("MSG_NOT_IN_COMBAT"));
            return;
        }
        this.window ??= this.buildWindow();
        this.window.open();
    }

    /** A fight starts: the window closes. */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    hideForCombat(): void {
        if (this.window?.isShown() === true) this.window.hide();
    }

    private buildWindow(): OptionsWindow {
        const readText = (key: TextKey) => this.locale.getText(key);
        const window = new OptionsWindow(
            "GlowingBarsProfiles",
            readText("PROFILES_TITLE"),
            {
                defaults: readText("BTN_DEFAULTS"),
                question: readText("MSG_DEFAULTS_QUESTION"),
                reset: readText("BTN_RESET"),
                cancel: readText("BTN_CANCEL"),
            },
            { width: BASIC_WINDOW_WIDTH, height: WINDOW_HEIGHT },
        );
        // Back to the settings, where it opens from, at the top left
        window.addTopLeftButton(readText("BTN_SETTINGS"), () => SlashCmdList[COMMAND]?.("settings", undefined as never));
        const tab = window.addTab(readText("TAB_PROFILES"), false);
        tab.addHeader(readText("HDR_PROFILE"));
        this.addCurrentRow(tab);
        this.addCopyRow(tab, window);
        this.addResetRow(tab, window);
        this.addReloadRow(tab);
        this.tab = tab;
        return window;
    }

    /** This character's profile, by name, where the other rows have their controls. */
    private addCurrentRow(tab: OptionsTab): void {
        const row = tab.createRow(this.locale.getText("OPT_CURRENT_PROFILE"), this.locale.getText("TIP_CURRENT_PROFILE"));
        const name = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        name.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT + 6, 0);
        name.SetWidth(findChoiceWidth(tab) - 6);
        name.SetJustifyH("LEFT");
        name.SetWordWrap(false);
        tab.addControl(row, {
            apply: () => undefined,
            refresh: () => name.SetText(this.settings.getProfileName()),
            setEnabled: () => undefined,
        });
    }

    /** A dropdown of the other profiles: the one picked is copied into this one's, asked first. */
    private addCopyRow(tab: OptionsTab, window: OptionsWindow): void {
        const row = tab.createRow(this.locale.getText("OPT_COPY_PROFILE"), this.locale.getText("TIP_COPY_PROFILE"));
        const button = this.createButton(row, CONTROL_LEFT, findChoiceWidth(tab));
        button.SetText("...");
        const pick = (value?: unknown) =>
            this.confirmThenAskReload(window, "Q_COPY_PROFILE", value as string, "BTN_COPY", () =>
                this.settings.copyProfile(value as string),
            );
        connectChoiceMenu(button, () =>
            this.settings
                .listProfileNames()
                .filter((name) => name !== this.settings.getProfileName())
                .map((name) => ({ label: name, isChosen: () => false, choose: () => pick(name) })),
        );
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_copyProfile`,
            apply: pick,
            refresh: () => button.SetEnabled(this.settings.listProfileNames().length > 1),
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => undefined,
        });
    }

    private addResetRow(tab: OptionsTab, window: OptionsWindow): void {
        const row = tab.createRow(this.locale.getText("OPT_RESET_PROFILE"), this.locale.getText("TIP_RESET_PROFILE"));
        const button = this.createButton(row, CONTROL_LEFT, BUTTON_WIDTH);
        button.SetText(this.locale.getText("BTN_RESET_PROFILE"));
        const reset = () =>
            this.confirmThenAskReload(window, "Q_RESET_PROFILE", this.settings.getProfileName(), "BTN_RESET_PROFILE", () => {
                this.settings.resetProfile();
                return true;
            });
        button.SetScript("OnClick", () => reset());
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_resetProfile`,
            apply: reset,
            refresh: () => undefined,
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => undefined,
        });
    }

    /** Reloads the interface by a click of its own, as the Welcome tab's button does; only once there is something to load. */
    private addReloadRow(tab: OptionsTab): void {
        const row = tab.createRow(this.locale.getText("OPT_PROFILE_RELOAD"), this.locale.getText("TIP_PROFILE_RELOAD"));
        const button = this.createButton(row, CONTROL_LEFT, BUTTON_WIDTH);
        button.SetText(this.locale.getText("BTN_RELOAD"));
        button.SetScript("OnClick", () => C_UI.Reload());
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_reloadProfile`,
            apply: () => C_UI.Reload(),
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
        }).showWhen(() => this.isReloadWaiting);
    }

    /**
     * Asks first; on yes, `act` and, when it took, a reload (the settings are read as the interface loads). Forever has
     * blocked that from the question's click: the Reload row shows, and the player is told, before it is tried.
     */
    private confirmThenAskReload(window: OptionsWindow, question: TextKey, name: string, yesText: TextKey, act: () => boolean): void {
        window.confirm(string.format(this.locale.getText(question), name), this.locale.getText(yesText), () => {
            if (!act()) return;
            this.isReloadWaiting = true;
            this.messages.say(this.locale.getText("MSG_TYPE_RELOAD"));
            this.tab?.refresh();
            C_UI.Reload();
        });
    }

    private createButton(row: Frame, left: number, width: number): Button {
        const button = CreateFrame("Button", undefined, row, "UIPanelButtonTemplate");
        button.SetSize(width, 22);
        button.SetPoint("LEFT", row, "LEFT", left, 0);
        // A name longer than the button is cut short with "...", not spilled over its edges
        const label = button.GetFontString();
        label?.SetWidth(width - 16);
        label?.SetWordWrap(false);
        return button;
    }
}

/** A dropdown: from where the controls start to the right edge of the row. */
function findChoiceWidth(tab: OptionsTab): number {
    return tab.getRowWidth() - CONTROL_LEFT;
}
