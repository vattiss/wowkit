// A row of tabs at the top of a window: a button for each, side by side in the middle, the one shown pressed (it cannot be
// clicked again). A tab with nothing on it for this character is left out. The settings window and the table of looks share
// it, so both look and work the same.

/** A tab is as wide as its words, and no narrower than this. */
const TAB_MIN_WIDTH = 64;
const TAB_TEXT_PADDING = 22;
const TAB_HEIGHT = 24;
const TAB_GAP = 2;

export class TabBar {
    private readonly buttons: Button[] = [];

    /** `top`: how far below the window's top edge the tabs are; `side`: the least room they leave at its sides. */
    constructor(
        private readonly window: Frame,
        private readonly top: number,
        private readonly side: number,
    ) {}

    /** A tab with these words; returns its index. A click on it calls `onClick`. */
    addTab(title: string, onClick: (this: void) => void): number {
        const button = CreateFrame("Button", undefined, this.window, "UIPanelButtonTemplate");
        button.SetText(title);
        button.SetSize(math.max(TAB_MIN_WIDTH, (button.GetTextWidth() ?? 0) + TAB_TEXT_PADDING), TAB_HEIGHT);
        button.SetScript("OnClick", onClick);
        this.buttons.push(button);
        return this.buttons.length - 1;
    }

    /** Side by side, in the middle, without the tabs that `isShown` leaves out. */
    showTabs(isShown: (this: void, index: number) => boolean): void {
        // In the middle: as far from the left edge as the last one is from the right
        const shown = this.buttons.filter((_button, index) => isShown(index));
        const total = shown.reduce((sum, button) => sum + button.GetWidth() + TAB_GAP, -TAB_GAP);
        let left = math.max(this.side, (this.window.GetWidth() - total) / 2);
        this.buttons.forEach((button, index) => {
            button.SetShown(isShown(index));
            if (!isShown(index)) return;
            button.ClearAllPoints();
            button.SetPoint("TOPLEFT", this.window, "TOPLEFT", left, -this.top);
            left += button.GetWidth() + TAB_GAP;
        });
    }

    /** The tab shown: its button is pressed, the others can be clicked. */
    select(selected: number): void {
        this.buttons.forEach((button, index) => button.SetEnabled(index !== selected));
    }
}
