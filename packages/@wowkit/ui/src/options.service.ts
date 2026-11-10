// The addon's settings: its own window, and in the game's Settings panel only a small page with a button to it. Nothing of
// the addon is drawn in the panel's shared rows (see OptionsWindow). The page only reads and changes settings
// (SettingsService.change); whoever cares reacts to "setting.changed".
import { OnGameEvent, type OnFirstLogin } from "@wowkit/core";
import type { MessagesService } from "./messages.service";
import { OptionsWindow } from "./options-window";

/** The page of an addon: it adds its tabs and controls to the window. */
export interface OptionsPage {
    getTexts(): OptionsTexts;
    buildPage(window: OptionsWindow): void;
}

/** The words the settings window needs, and its size. */
export interface OptionsTexts {
    title: string;
    open: string;
    /** The tooltip of that button: another way to open the window. */
    openTip: string;
    defaults: string;
    /** Said instead of opening the window in a fight. */
    inCombat: string;
    /** Said when a fight starts while the window is open, and it closes. */
    closedForCombat: string;
    size: { width: number; height: number };
}

export class OptionsService implements OnFirstLogin {
    private window: OptionsWindow | undefined;

    constructor(
        private readonly messages: MessagesService,
        /** The name of the window's frame. */
        private readonly windowName: string,
        private readonly page: OptionsPage,
    ) {}

    /** Builds the window and adds the small page at the first login; a failure is printed, never thrown. */
    onFirstLogin(): void {
        if (this.window !== undefined) return;
        const [didSucceed, error] = pcall(() => this.registerPage());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    private registerPage(): void {
        const texts = this.page.getTexts();
        const window = new OptionsWindow(this.windowName, texts.title, texts.defaults, texts.size);
        this.page.buildPage(window);
        this.window = window;
        if (typeof Settings === "undefined") return;
        const panel = CreateFrame("Frame");
        const button = CreateFrame("Button", undefined, panel, "UIPanelButtonTemplate");
        button.SetSize(220, 26);
        button.SetPoint("TOPLEFT", panel, "TOPLEFT", 16, -16);
        button.SetText(texts.open);
        button.SetScript("OnClick", () => this.open());
        // Our own button: its tooltip touches nothing of the panel's shared rows
        button.SetScript("OnEnter", () => {
            GameTooltip.SetOwner(button, "ANCHOR_RIGHT");
            GameTooltip.SetText(texts.openTip, 1, 1, 1, 1, true);
            GameTooltip.Show();
        });
        button.SetScript("OnLeave", () => GameTooltip.Hide());
        Settings.RegisterAddOnCategory(Settings.RegisterCanvasLayoutCategory(panel, texts.title));
    }

    /** A fight starts: the window closes, as EllesmereUI's does. */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    hideForCombat(): void {
        if (this.window?.isShown() !== true) return;
        this.window.hide();
        this.messages.say(this.page.getTexts().closedForCombat);
    }

    /** Blizzard's panel closes first, and the window opens a frame later: out of whatever opened it, as a slash command. */
    open(): void {
        // Not in a fight, as EllesmereUI does: closing Blizzard's panel then has rules of its own, and the gamepad would be held
        if (InCombatLockdown()) {
            this.messages.say(this.page.getTexts().inCombat);
            return;
        }
        const panel = (_G as unknown as { SettingsPanel?: Frame }).SettingsPanel;
        if (panel?.IsShown() === true) HideUIPanel(panel);
        C_Timer.After(0, () => this.window?.open());
    }
}
