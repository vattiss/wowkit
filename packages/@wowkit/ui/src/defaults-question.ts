// The question before the Defaults button puts a tab back. A box of the window's own, not the game's dialogs (StaticPopup):
// those are shared with the game's own confirmations, and taint carried into them blocks what the game does next.
import { createFrameWithBorder } from "./window-frame";

/** The least width of the box; a longer line or yes makes it wider, up to the most. */
const BOX_WIDTH = 380;
const MOST_BOX_WIDTH = 620;
/** Between the box's edges and the question. */
const TEXT_SIDES = 48;
/** The least height of the box; a longer question makes it taller. */
const BOX_HEIGHT = 120;
/** Above the question, and below it to the buttons' bottom edge. */
const TEXT_TOP = 30;
const BELOW_TEXT = 64;
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
    private readonly box: Frame;
    private readonly text: FontString;
    private readonly question: string;
    private onReset: ((this: void) => void) | undefined;
    private readonly yesButton: Button;
    private readonly cancelButton: Button;
    private readonly resetText: string;

    constructor(window: Frame, name: string, texts: DefaultsQuestionTexts) {
        this.cover = CreateFrame("Frame", undefined, window);
        this.cover.SetAllPoints(window);
        this.cover.SetFrameLevel(window.GetFrameLevel() + 50);
        this.cover.EnableMouse(true);
        const shade = this.cover.CreateTexture(undefined, "BACKGROUND");
        shade.SetAllPoints(this.cover);
        shade.SetColorTexture(0, 0, 0, 0.5);
        const box = (this.box = createFrameWithBorder(name));
        box.SetParent(this.cover);
        box.SetFrameLevel(this.cover.GetFrameLevel() + 1);
        box.SetSize(BOX_WIDTH, BOX_HEIGHT);
        box.SetPoint("CENTER", this.cover, "CENTER", 0, 0);
        this.text = box.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        this.text.SetPoint("TOP", box, "TOP", 0, -TEXT_TOP);
        this.text.SetWidth(BOX_WIDTH - TEXT_SIDES);
        this.yesButton = this.addButton(box, texts.reset, -BUTTON_WIDTH / 2 - 6, () => {
            this.cover.Hide();
            this.onReset?.();
        });
        this.resetText = texts.reset;
        this.cancelButton = this.addButton(box, texts.cancel, BUTTON_WIDTH / 2 + 6, () => this.cover.Hide());
        this.question = texts.question;
        // The window closing, by Escape or for a fight, is a no
        window.HookScript("OnHide", () => this.cover.Hide());
        this.cover.Hide();
    }

    /** Opens the question before putting the tab of this name back; `onReset` only on Reset. */
    open(tabName: string, onReset: (this: void) => void): void {
        this.confirm(string.format(this.question, tabName), this.resetText, onReset);
    }

    /** Asks any question first: `onYes` only on its yes button, which says `yesText` (Switch, Delete...). */
    confirm(question: string, yesText: string, onYes: (this: void) => void): void {
        this.onReset = onYes;
        this.yesButton.SetText(yesText);
        // A long yes ("Delete from all characters") makes both buttons wider, alike; a long line the box, a list it taller
        const buttonWidth = math.max(BUTTON_WIDTH, this.measureLine(yesText) + 24);
        let lineWidth = 0;
        for (const line of question.split("\n")) lineWidth = math.max(lineWidth, this.measureLine(line));
        const width = math.min(MOST_BOX_WIDTH, math.max(BOX_WIDTH, lineWidth + TEXT_SIDES, 2 * buttonWidth + 12 + TEXT_SIDES));
        this.box.SetWidth(width);
        this.text.SetWidth(width - TEXT_SIDES);
        this.text.SetText(question);
        const textHeight = (this.text.GetStringHeight() as number | undefined) ?? 0;
        this.box.SetHeight(math.max(BOX_HEIGHT, TEXT_TOP + textHeight + BELOW_TEXT));
        this.setButtonPlace(this.yesButton, buttonWidth, -1);
        this.setButtonPlace(this.cancelButton, buttonWidth, 1);
        this.cover.Show();
    }

    /** A line's width in the question's font, unwrapped; 0 where the client cannot tell. */
    private measureLine(line: string): number {
        return (this.text.GetUnboundedStringWidthForText(line) as number | undefined) ?? 0;
    }

    /** A button of this width, to the left (-1) or right (1) of the middle. */
    private setButtonPlace(button: Button, width: number, side: number): void {
        button.SetWidth(width);
        button.ClearAllPoints();
        button.SetPoint("BOTTOM", this.box, "BOTTOM", side * (width / 2 + 6), 20);
    }

    private addButton(box: Frame, text: string, x: number, onClick: (this: void) => void): Button {
        const button = CreateFrame("Button", undefined, box, "UIPanelButtonTemplate");
        button.SetSize(BUTTON_WIDTH, 22);
        button.SetPoint("BOTTOM", box, "BOTTOM", x, 20);
        button.SetText(text);
        button.SetScript("OnClick", () => onClick());
        return button;
    }
}
