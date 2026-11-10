// The addon's own settings window, with a tab for each subject. The game's Settings panel reuses the same rows on all its
// pages, so rows that drew an addon's settings carry its taint to the game's own pages (the action bars among them), and
// the game then refuses to lay out the bars in a fight. Nothing here is shared with the game.
import { OptionsTab } from "./options-tab";
import { applyScrollBarTint, connectEscape, createCloseButton, createFrameWithBorder } from "./window-frame";

const WINDOW_WIDTH = 690;
const WINDOW_HEIGHT = 570;
const SIDE = 22;
const CONTENT_WIDTH = WINDOW_WIDTH - SIDE * 2 - 24;
/** A tab is as wide as its words, and no narrower than this. */
const TAB_MIN_WIDTH = 100;
const TAB_TEXT_PADDING = 28;
const TAB_HEIGHT = 24;
const TAB_TOP = 46;
const SCROLL_TOP = 80;
const SCROLL_BOTTOM = 48;

export class OptionsWindow {
    private readonly window: Frame;
    private readonly scroll: ScrollFrame;
    private readonly tabs: OptionsTab[] = [];
    private readonly tabButtons: Button[] = [];
    private current: OptionsTab | undefined;

    constructor(name: string, title: string, defaultsText: string) {
        this.window = this.createFrame(name, title);
        this.scroll = CreateFrame("ScrollFrame", undefined, this.window, "UIPanelScrollFrameTemplate");
        this.scroll.SetPoint("TOPLEFT", this.window, "TOPLEFT", SIDE, -SCROLL_TOP);
        this.scroll.SetPoint("BOTTOMRIGHT", this.window, "BOTTOMRIGHT", -SIDE - 24, SCROLL_BOTTOM);
        applyScrollBarTint(this.scroll);
        this.createDefaultsButton(defaultsText);
        // A new frame is shown; the window opens when it is asked for
        this.window.Hide();
    }

    private createFrame(name: string, title: string): Frame {
        const window = createFrameWithBorder(name);
        window.SetSize(WINDOW_WIDTH, WINDOW_HEIGHT);
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

    private createDefaultsButton(text: string): void {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetSize(110, 22);
        button.SetPoint("BOTTOMLEFT", this.window, "BOTTOMLEFT", SIDE, 16);
        button.SetText(text);
        button.SetScript("OnClick", () => this.current?.resetToDefaults());
    }

    /** A button in the top corner, to another window. */
    addTopButton(text: string, onClick: (this: void) => void): void {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetSize(100, 22);
        button.SetPoint("TOPLEFT", this.window, "TOPLEFT", SIDE, -14);
        button.SetText(text);
        button.SetScript("OnClick", () => onClick());
    }

    addTab(title: string): OptionsTab {
        const tab = new OptionsTab(this.scroll, title, CONTENT_WIDTH);
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetText(title);
        button.SetSize(math.max(TAB_MIN_WIDTH, (button.GetTextWidth() ?? 0) + TAB_TEXT_PADDING), TAB_HEIGHT);
        button.SetScript("OnClick", () => this.selectTab(tab));
        this.tabs.push(tab);
        this.tabButtons.push(button);
        return tab;
    }

    open(): void {
        this.updateTabButtons();
        for (const tab of this.tabs) tab.refresh();
        this.selectTab(this.current ?? this.tabs.find((tab) => tab.hasRows()));
        this.window.Show();
    }

    /** Side by side, without the tabs that have nothing on them for this character. */
    private updateTabButtons(): void {
        let left = SIDE;
        this.tabs.forEach((tab, index) => {
            const button = this.tabButtons[index]!;
            button.SetShown(tab.hasRows());
            if (!tab.hasRows()) return;
            button.ClearAllPoints();
            button.SetPoint("TOPLEFT", this.window, "TOPLEFT", left, -TAB_TOP);
            left += button.GetWidth() + 2;
        });
    }

    private selectTab(tab: OptionsTab | undefined): void {
        if (tab === undefined) return;
        this.current?.content.Hide();
        this.current = tab;
        tab.refresh();
        tab.content.Show();
        this.scroll.SetScrollChild(tab.content);
        this.scroll.SetVerticalScroll(0);
        this.tabs.forEach((other, index) => this.tabButtons[index]!.SetEnabled(other !== tab));
    }
}
