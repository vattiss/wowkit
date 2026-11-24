// The Profiles window (issue #76), opened by the buttons at the top left of the settings and the table, or /gb profiles: the
// profile this character uses, and what can be done with the profiles of the account; on a tab of its own, the spells added
// on its characters. A switch, a copy or a reset takes effect from the next load of the interface, as the settings are read
// then: those ask first, then reload it.
import { OnGameEvent } from "@wowkit/core";
import { connectChoiceMenu, type MessagesService, OptionsWindow, type OptionsTab } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { CharacterSpellsSection } from "./character-spells.section";
import { BASIC_WINDOW_WIDTH, WINDOW_HEIGHT } from "./style-table.constants";
import { COMMAND } from "./table-command";

const BUTTON_WIDTH = 80;
/** Where the controls of a row start, as the settings window's do. */
const CONTROL_LEFT = 340;
/** The start of each control's name, so the window's controls are found by it. */
const VARIABLE_PREFIX = "GlowingBars";
/** The longest a profile's name may be, as the box takes. */
const MOST_NAME_LETTERS = 40;

export class ProfilesWindowService {
    private window: OptionsWindow | undefined;

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly messages: MessagesService,
        private readonly spellsSection: CharacterSpellsSection,
    ) {}

    /** Opens the window (built the first time); not in a fight. */
    open(): void {
        if (InCombatLockdown()) {
            this.messages.say(this.locale.getText("MSG_NOT_IN_COMBAT"));
            return;
        }
        this.window ??= this.buildWindow();
        this.spellsSection.update();
        this.window.open();
    }

    /** An item's data came in: the Added spells tab names it, where it was waiting for it. */
    @OnGameEvent("GET_ITEM_INFO_RECEIVED")
    refreshItemNames(itemId: number): void {
        if (this.window?.isShown() === true) this.spellsSection.refreshNames(itemId);
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
        // As the settings window has them: to the settings at the top left, to the table at the top right
        window.addTopLeftButton(readText("BTN_SETTINGS"), () => SlashCmdList[COMMAND]?.("settings", undefined as never));
        window.addTopButton(readText("BTN_OPEN_TABLE"), () => SlashCmdList[COMMAND]?.("", undefined as never));
        const tab = window.addTab(readText("TAB_PROFILES"), false);
        tab.addHeader(readText("HDR_PROFILE"));
        tab.addText(() => string.format(readText("PROFILE_CURRENT"), this.settings.getProfileName()), "GameFontNormalSmall");
        this.addSwitchRow(tab, window);
        this.addNameRow(tab, "newProfile", "OPT_NEW_PROFILE", "TIP_NEW_PROFILE", "BTN_CREATE", (name) => this.confirmCreate(window, name));
        this.addProfileChoice(tab, "copyProfile", "OPT_COPY_PROFILE", "TIP_COPY_PROFILE", (name) => this.confirmCopy(window, name));
        this.addNameRow(tab, "renameProfile", "OPT_RENAME_PROFILE", "TIP_RENAME_PROFILE", "BTN_RENAME", (name) =>
            this.changeName(tab, name),
        );
        this.addProfileChoice(tab, "deleteProfile", "OPT_DELETE_PROFILE", "TIP_DELETE_PROFILE", (name) =>
            this.confirmDelete(window, tab, name),
        );
        this.addResetRow(tab, window);
        this.spellsSection.build(window, window.addTab(readText("TAB_ADDED_SPELLS"), false));
        return window;
    }

    /** The profile this character uses: another one picked is switched to, asked first. */
    private addSwitchRow(tab: OptionsTab, window: OptionsWindow): void {
        const row = tab.createRow(this.locale.getText("OPT_PROFILE"), this.locale.getText("TIP_PROFILE"));
        const button = this.createButton(row, CONTROL_LEFT, findChoiceWidth(tab));
        const pick = (value?: unknown) => {
            const name = value as string;
            if (name === this.settings.getProfileName()) return;
            this.confirmThenReload(window, "Q_SWITCH_PROFILE", name, "BTN_SWITCH", () => this.settings.useProfile(name));
        };
        connectChoiceMenu(button, () =>
            this.settings.listProfileNames().map((name) => ({
                label: name,
                isChosen: () => name === this.settings.getProfileName(),
                choose: () => pick(name),
            })),
        );
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_profile`,
            apply: pick,
            refresh: () => button.SetText(this.settings.getProfileName()),
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => undefined,
        });
    }

    /** A dropdown of the other profiles; the one picked is handed on. */
    private addProfileChoice(tab: OptionsTab, variable: string, label: TextKey, tooltip: TextKey, onPick: (name: string) => void): void {
        const row = tab.createRow(this.locale.getText(label), this.locale.getText(tooltip));
        const button = this.createButton(row, CONTROL_LEFT, findChoiceWidth(tab));
        button.SetText("...");
        const pick = (value?: unknown) => onPick(value as string);
        connectChoiceMenu(button, () =>
            this.settings
                .listProfileNames()
                .filter((name) => name !== this.settings.getProfileName())
                .map((name) => ({ label: name, isChosen: () => false, choose: () => pick(name) })),
        );
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_${variable}`,
            apply: pick,
            refresh: () => button.SetEnabled(this.settings.listProfileNames().length > 1),
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => undefined,
        });
    }

    /** A name box and a button beside it; the name typed (or given) is handed on. */
    private addNameRow(
        tab: OptionsTab,
        variable: string,
        label: TextKey,
        tooltip: TextKey,
        buttonText: TextKey,
        onName: (name: string) => void,
    ): void {
        const row = tab.createRow(this.locale.getText(label), this.locale.getText(tooltip));
        const box = CreateFrame("EditBox", undefined, row, "InputBoxTemplate");
        const boxWidth = findChoiceWidth(tab) - BUTTON_WIDTH - 6;
        box.SetSize(boxWidth - 8, 20);
        box.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT + 6, 0);
        box.SetAutoFocus(false);
        box.SetMaxLetters(MOST_NAME_LETTERS);
        const button = this.createButton(row, CONTROL_LEFT + boxWidth + 6, BUTTON_WIDTH);
        button.SetText(this.locale.getText(buttonText));
        const applyName = (value?: unknown) => {
            const name = strtrim((value as string | undefined) ?? box.GetText());
            box.SetText("");
            box.ClearFocus();
            onName(name);
        };
        button.SetScript("OnClick", () => applyName());
        box.SetScript("OnEnterPressed", () => applyName());
        box.SetScript("OnEscapePressed", () => box.ClearFocus());
        tab.addControl(row, {
            variable: `${VARIABLE_PREFIX}_${variable}`,
            apply: applyName,
            refresh: () => undefined,
            setEnabled: (isEnabled) => button.SetEnabled(isEnabled),
            reset: () => undefined,
        });
    }

    private addResetRow(tab: OptionsTab, window: OptionsWindow): void {
        const row = tab.createRow(this.locale.getText("OPT_RESET_PROFILE"), this.locale.getText("TIP_RESET_PROFILE"));
        const button = this.createButton(row, CONTROL_LEFT, BUTTON_WIDTH);
        button.SetText(this.locale.getText("BTN_RESET_PROFILE"));
        const reset = () =>
            this.confirmThenReload(window, "Q_RESET_PROFILE", this.settings.getProfileName(), "BTN_RESET_PROFILE", () => {
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

    /** A name that is empty, too long or taken is said so; another is made a profile and switched to, asked first. */
    private confirmCreate(window: OptionsWindow, name: string): void {
        if (name === "" || name.length > MOST_NAME_LETTERS || this.settings.listProfileNames().includes(name)) {
            this.messages.say(this.locale.getText("MSG_PROFILE_NAME"));
            return;
        }
        this.confirmThenReload(
            window,
            "Q_CREATE_PROFILE",
            name,
            "BTN_CREATE",
            () => this.settings.createProfile(name) && this.settings.useProfile(name),
        );
    }

    private confirmCopy(window: OptionsWindow, name: string): void {
        this.confirmThenReload(window, "Q_COPY_PROFILE", name, "BTN_COPY", () => this.settings.copyProfile(name));
    }

    private confirmDelete(window: OptionsWindow, tab: OptionsTab, name: string): void {
        window.confirm(string.format(this.locale.getText("Q_DELETE_PROFILE"), name), this.locale.getText("BTN_DELETE"), () => {
            this.settings.deleteProfile(name);
            tab.refresh();
        });
    }

    private changeName(tab: OptionsTab, name: string): void {
        if (!this.settings.changeProfileName(name)) this.messages.say(this.locale.getText("MSG_PROFILE_NAME"));
        tab.refresh();
    }

    /** Asks first; on yes, `act` and, when it took, a reload of the interface (the settings are read as it loads). */
    private confirmThenReload(window: OptionsWindow, question: TextKey, name: string, yesText: TextKey, act: () => boolean): void {
        window.confirm(string.format(this.locale.getText(question), name), this.locale.getText(yesText), () => {
            if (act()) C_UI.Reload();
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

/** A dropdown, or a name box with its button: from where the controls start to the right edge of the row. */
function findChoiceWidth(tab: OptionsTab): number {
    return tab.getRowWidth() - CONTROL_LEFT;
}
