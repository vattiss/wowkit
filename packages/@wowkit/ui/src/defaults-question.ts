// The question before the Defaults button puts a tab back. A box of the window's own, not the game's dialogs (StaticPopup):
// those are shared with the game's own confirmations, and taint carried into them blocks what the game does next.
import { createFrameWithBorder } from "./window-frame";

const BOX_WIDTH = 380;
const BOX_HEIGHT = 120;
const BUTTON_WIDTH = 110;

/** The words of the box. */
export interface DefaultsQuestionTexts {
    /** "Reset the %s tab to its defaults?", with the name of the tab. */
    question: string;
    reset: string;
    cancel: string;
}

export class DefaultsQuestion {
    /** Over the whole window, so nothing under it can be clicked while it asks. */
    private readonly cover: Frame;
    private readonly text: FontString;
    private readonly question: string;
    private onReset: ((this: void) => void) | undefined;

    constructor(window: Frame, name: string, texts: DefaultsQuestionTexts) {
        this.cover = CreateFrame("Frame", undefined, window);
        this.cover.SetAllPoints(window);
        this.cover.SetFrameLevel(window.GetFrameLevel() + 50);
        this.cover.EnableMouse(true);
        const shade = this.cover.CreateTexture(undefined, "BACKGROUND");
        shade.SetAllPoints(this.cover);
        shade.SetColorTexture(0, 0, 0, 0.5);
        const box = createFrameWithBorder(name);
        box.SetParent(this.cover);
        box.SetFrameLevel(this.cover.GetFrameLevel() + 1);
        box.SetSize(BOX_WIDTH, BOX_HEIGHT);
        box.SetPoint("CENTER", this.cover, "CENTER", 0, 0);
        this.text = box.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        this.text.SetPoint("TOP", box, "TOP", 0, -30);
        this.text.SetWidth(BOX_WIDTH - 48);
        this.addButton(box, texts.reset, -BUTTON_WIDTH / 2 - 6, () => {
            this.cover.Hide();
            this.onReset?.();
        });
        this.addButton(box, texts.cancel, BUTTON_WIDTH / 2 + 6, () => this.cover.Hide());
        this.question = texts.question;
        // The window closing, by Escape or for a fight, is a no
        window.HookScript("OnHide", () => this.cover.Hide());
        this.cover.Hide();
    }

    /** Opens the question before putting the tab of this name back; `onReset` only on Reset. */
    open(tabName: string, onReset: (this: void) => void): void {
        this.onReset = onReset;
        this.text.SetText(string.format(this.question, tabName));
        this.cover.Show();
    }

    private addButton(box: Frame, text: string, x: number, onClick: (this: void) => void): void {
        const button = CreateFrame("Button", undefined, box, "UIPanelButtonTemplate");
        button.SetSize(BUTTON_WIDTH, 22);
        button.SetPoint("BOTTOM", box, "BOTTOM", x, 20);
        button.SetText(text);
        button.SetScript("OnClick", () => onClick());
    }
}
