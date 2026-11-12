// The addon's own settings window, with a tab for each subject. The game's Settings panel reuses the same rows on all its
// pages, so rows that drew an addon's settings carry its taint to the game's own pages (the action bars among them), and
// the game then refuses to lay out the bars in a fight. Nothing here is shared with the game.
import { DefaultsQuestion, type DefaultsQuestionTexts } from "./defaults-question";
import { OptionsTab } from "./options-tab";
import { applyScrollBarTint, connectEscape, createCloseButton, createFrameWithBorder, updateScrollBar } from "./window-frame";

const SIDE = 22;
/** The scroll bar, on the right of the tabs' rows. */
const SCROLL_BAR_WIDTH = 24;
/** A tab is as wide as its words, and no narrower than this. */
const TAB_MIN_WIDTH = 64;
const TAB_TEXT_PADDING = 22;
const TAB_HEIGHT = 24;
const TAB_GAP = 2;
const TAB_TOP = 46;
const SCROLL_TOP = 80;
const SCROLL_BOTTOM = 48;

export class OptionsWindow {
    private readonly window: Frame;
    private readonly scroll: ScrollFrame;
    private readonly tabs: OptionsTab[] = [];
    private readonly tabButtons: Button[] = [];
    private current: OptionsTab | undefined;
    private defaultsButton: Button | undefined;
    private readonly question: DefaultsQuestion;

    private readonly contentWidth: number;

    /** `texts`: the Defaults button, and the question it asks first. */
    constructor(name: string, title: string, texts: DefaultsQuestionTexts & { defaults: string }, size: { width: number; height: number }) {
        this.contentWidth = size.width - SIDE * 2 - SCROLL_BAR_WIDTH;
        this.window = this.createFrame(name, title);
        this.window.SetSize(size.width, size.height);
        this.scroll = CreateFrame("ScrollFrame", undefined, this.window, "UIPanelScrollFrameTemplate");
        this.scroll.SetPoint("TOPLEFT", this.window, "TOPLEFT", SIDE, -SCROLL_TOP);
        this.scroll.SetPoint("BOTTOMRIGHT", this.window, "BOTTOMRIGHT", -SIDE - 24, SCROLL_BOTTOM);
        applyScrollBarTint(this.scroll);
        this.createDefaultsButton(texts.defaults);
        this.question = new DefaultsQuestion(this.window, `${name}Question`, texts);
        // A new frame is shown; the window opens when it is asked for
        this.window.Hide();
    }

    private createFrame(name: string, title: string): Frame {
        const window = createFrameWithBorder(name);
        window.SetPoint("CENTER", UIParent, "CENTER", 0, 0);
        window.SetFrameStrata("DIALOG");
        window.SetMovable(true);
        window.EnableMouse(true);
        window.RegisterForDrag("LeftButton");
        window.SetScript("OnDragStart", () => window.StartMoving());
        window.SetScript("OnDragStop", () => window.StopMovingOrSizing());
        connectEscape(window);
        const heading = window.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
        heading.SetPoint("TOP", window, "TOP", 0, -16);
        heading.SetText(title);
        createCloseButton(window);
        return window;
    }

    /** At the bottom right; only for the tab shown, and not on a tab without defaults. */
    private createDefaultsButton(text: string): void {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetSize(110, 22);
        button.SetPoint("BOTTOMRIGHT", this.window, "BOTTOMRIGHT", -SIDE, 16);
        this.defaultsButton = button;
        button.SetText(text);
        button.SetScript("OnClick", () => {
            const tab = this.current;
            if (tab !== undefined) this.question.open(tab.title, () => tab.resetToDefaults());
        });
    }

    /** A button in the top corner, beside the close button, to another window: this one closes for it. */
    addTopButton(text: string, onClick: (this: void) => void): void {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetSize(100, 22);
        button.SetPoint("TOPRIGHT", this.window, "TOPRIGHT", -34, -9);
        button.SetText(text);
        button.SetScript("OnClick", () => {
            this.window.Hide();
            onClick();
        });
    }

    /** `hasDefaults`: false for a tab with nothing to put back (the notes of the versions, the help). */
    addTab(title: string, hasDefaults = true): OptionsTab {
        const tab = new OptionsTab(this.scroll, title, this.contentWidth, this.window, hasDefaults);
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetText(title);
        button.SetSize(math.max(TAB_MIN_WIDTH, (button.GetTextWidth() ?? 0) + TAB_TEXT_PADDING), TAB_HEIGHT);
        button.SetScript("OnClick", () => this.selectTab(tab));
        tab.useHeightListener((height) => {
            if (tab === this.current) updateScrollBar(this.scroll, height);
        });
        this.tabs.push(tab);
        this.tabButtons.push(button);
        return tab;
    }

    isShown(): boolean {
        return this.window.IsShown();
    }

    hide(): void {
        this.window.Hide();
    }

    /** On this tab, or the one it was on. */
    open(tab?: OptionsTab): void {
        this.updateTabButtons();
        for (const each of this.tabs) each.refresh();
        // Shown first: the game measures the height of a text only on the screen
        this.window.Show();
        this.selectTab(tab ?? this.current ?? this.tabs.find((each) => each.hasRows()));
    }

    /** Side by side, without the tabs that have nothing on them for this character. */
    private updateTabButtons(): void {
        // In the middle: as far from the left edge as the last one is from the right
        const shown = this.tabButtons.filter((_button, index) => this.tabs[index]!.hasRows());
        const total = shown.reduce((sum, button) => sum + button.GetWidth() + TAB_GAP, -TAB_GAP);
        let left = math.max(SIDE, (this.window.GetWidth() - total) / 2);
        this.tabs.forEach((tab, index) => {
            const button = this.tabButtons[index]!;
            button.SetShown(tab.hasRows());
            if (!tab.hasRows()) return;
            button.ClearAllPoints();
            button.SetPoint("TOPLEFT", this.window, "TOPLEFT", left, -TAB_TOP);
            left += button.GetWidth() + TAB_GAP;
        });
    }

    private selectTab(tab: OptionsTab | undefined): void {
        if (tab === undefined) return;
        this.current?.setShown(false);
        this.current = tab;
        tab.setShown(true);
        this.defaultsButton?.SetShown(tab.hasDefaults);
        tab.refresh();
        this.scroll.SetScrollChild(tab.content);
        this.scroll.SetVerticalScroll(0);
        this.tabs.forEach((other, index) => this.tabButtons[index]!.SetEnabled(other !== tab));
    }
}
