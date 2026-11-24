// The addon's own settings window, with a tab for each subject. The game's Settings panel reuses the same rows on all its
// pages, so rows that drew an addon's settings carry its taint to the game's own pages (the action bars among them), and
// the game then refuses to lay out the bars in a fight. Nothing here is shared with the game.
import { DefaultsQuestion, type DefaultsQuestionTexts } from "./defaults-question";
import { OptionsTab } from "./options-tab";
import { TabBar } from "./tab-bar";
import { applyScrollBarTint, connectEscape, createCloseButton, createFrameWithBorder, updateScrollBar } from "./window-frame";

const SIDE = 22;
/** The scroll bar, on the right of the tabs' rows. */
const SCROLL_BAR_WIDTH = 24;
const TAB_TOP = 46;
/** Where the rows start: under the tabs' buttons, or where those would be in a window of one tab. */
const SCROLL_TOP = 80;
const SCROLL_BOTTOM = 48;

export class OptionsWindow {
    private readonly window: Frame;
    private readonly scroll: ScrollFrame;
    private readonly tabs: OptionsTab[] = [];
    private readonly tabBar: TabBar;
    private current: OptionsTab | undefined;
    private defaultsButton: Button | undefined;
    private readonly question: DefaultsQuestion;

    private readonly contentWidth: number;

    /** `texts`: the Defaults button, and the question it asks first. */
    constructor(name: string, title: string, texts: DefaultsQuestionTexts & { defaults: string }, size: { width: number; height: number }) {
        this.contentWidth = size.width - SIDE * 2 - SCROLL_BAR_WIDTH;
        this.window = this.createFrame(name, title);
        this.window.SetSize(size.width, size.height);
        this.tabBar = new TabBar(this.window, TAB_TOP, SIDE);
        this.scroll = CreateFrame("ScrollFrame", undefined, this.window, "UIPanelScrollFrameTemplate");
        this.setScrollTop(SCROLL_TOP);
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

    /** A button in the top left corner, to another window: this one closes for it. */
    addTopLeftButton(text: string, onClick: (this: void) => void): void {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetSize(100, 22);
        button.SetPoint("TOPLEFT", this.window, "TOPLEFT", 12, -9);
        button.SetText(text);
        button.SetScript("OnClick", () => {
            this.window.Hide();
            onClick();
        });
    }

    /** Asks first, over the window: `onYes` only on its yes button, which says `yesText`. */
    confirm(question: string, yesText: string, onYes: (this: void) => void): void {
        this.question.confirm(question, yesText, onYes);
    }

    /** `hasDefaults`: false for a tab with nothing to put back (the notes of the versions, the help). */
    addTab(title: string, hasDefaults = true): OptionsTab {
        const tab = new OptionsTab(this.scroll, title, this.contentWidth, this.window, hasDefaults);
        this.tabBar.addTab(title, () => this.selectTab(tab));
        tab.useHeightListener((height) => {
            if (tab === this.current) updateScrollBar(this.scroll, height);
        });
        this.tabs.push(tab);
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

    /** Side by side, without the tabs that have nothing on them for this character; none for a window of one tab. */
    private updateTabButtons(): void {
        const hasTabBar = this.tabs.length > 1;
        this.tabBar.showTabs((index) => hasTabBar && this.tabs[index]!.hasRows());
        this.setScrollTop(hasTabBar ? SCROLL_TOP : TAB_TOP);
    }

    private setScrollTop(top: number): void {
        this.scroll.ClearAllPoints();
        this.scroll.SetPoint("TOPLEFT", this.window, "TOPLEFT", SIDE, -top);
        this.scroll.SetPoint("BOTTOMRIGHT", this.window, "BOTTOMRIGHT", -SIDE - 24, SCROLL_BOTTOM);
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
        this.tabBar.select(this.tabs.indexOf(tab));
    }
}
