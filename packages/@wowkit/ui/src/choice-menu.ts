// A button that opens a dropdown list of its choices. A list of our own, not the game's menu (MenuUtil): in gamepad mode
// the game hands every menu that opens the gamepad's controls, and a menu an addon opened leaves those controls marked as
// the addon's, so the game then blocks what its gamepad bar does next (SetPreferredGamepadInteractTarget).
import { applyScrollBarTint, BORDER_COLOR, connectEscape, updateScrollBar } from "./window-frame";

/** How long a list may be before it scrolls, in lines. */
const MOST_LINES = 16;
const LINE_HEIGHT = 20;
/** The space between the border and the lines. */
const PADDING = 8;
const CHECK_SIZE = 16;
/** The room the scroll bar takes right of the lines. */
const SCROLL_BAR_WIDTH = 24;

/** One line of the list. */
export interface MenuChoice {
    label: string;
    isChosen: (this: void) => boolean;
    choose: (this: void) => void;
}

/** A click on the button lists the choices; picking one, a click elsewhere or Escape closes the list. */
export function connectChoiceMenu(button: Button, listChoices: () => MenuChoice[]): void {
    let list: ChoiceList | undefined;
    button.SetScript("OnClick", () => {
        // A second click on the button closes its list
        if (list?.isOpen() === true) return list.hide();
        const choices = listChoices();
        if (choices.length === 0) return;
        list ??= new ChoiceList(button);
        list.open(choices);
    });
}

interface ChoiceLine {
    button: Button;
    check: Texture;
    label: FontString;
}

/** The list of one button, made on its first click; its lines are kept for the next one. */
class ChoiceList {
    private readonly frame: Frame;
    private readonly scroll: ScrollFrame;
    private readonly content: Frame;
    private readonly lines: ChoiceLine[] = [];

    constructor(private readonly owner: Button) {
        this.frame = createListFrame();
        this.frame.SetPoint("TOPLEFT", owner, "BOTTOMLEFT", 0, 2);
        this.scroll = CreateFrame("ScrollFrame", undefined, this.frame, "UIPanelScrollFrameTemplate");
        this.scroll.SetPoint("TOPLEFT", this.frame, "TOPLEFT", PADDING, -PADDING);
        applyScrollBarTint(this.scroll);
        this.content = CreateFrame("Frame", undefined, this.scroll);
        this.scroll.SetScrollChild(this.content);
        connectEscape(this.frame);
        // A click anywhere else closes it; one on the button is left to the button's own click
        this.frame.SetScript("OnEvent", () => {
            if (!this.frame.IsMouseOver() && !owner.IsMouseOver()) this.hide();
        });
        this.frame.SetScript("OnShow", () => this.frame.RegisterEvent("GLOBAL_MOUSE_DOWN"));
        this.frame.SetScript("OnHide", () => this.frame.UnregisterEvent("GLOBAL_MOUSE_DOWN"));
        // The window closing closes it too
        owner.HookScript("OnHide", () => this.hide());
        this.frame.Hide();
    }

    isOpen(): boolean {
        return this.frame.IsShown();
    }

    hide(): void {
        this.frame.Hide();
    }

    open(choices: MenuChoice[]): void {
        let textWidth = 0;
        choices.forEach((choice, index) => {
            const line = this.lines[index] ?? this.createLine(index);
            line.label.SetText(choice.label);
            line.check.SetShown(choice.isChosen());
            line.button.SetScript("OnClick", () => {
                this.hide();
                choice.choose();
            });
            line.button.Show();
            textWidth = Math.max(textWidth, (line.label.GetStringWidth() as number | undefined) ?? 0);
        });
        for (const line of this.lines.slice(choices.length)) line.button.Hide();
        const isScrolling = choices.length > MOST_LINES;
        const barWidth = isScrolling ? SCROLL_BAR_WIDTH : 0;
        // As wide as the button at least, and as the longest choice
        const lineWidth = Math.max(this.owner.GetWidth() - 2 * PADDING - barWidth, CHECK_SIZE + textWidth + 16);
        for (const line of this.lines) line.button.SetWidth(lineWidth);
        const shownHeight = Math.min(choices.length, MOST_LINES) * LINE_HEIGHT;
        this.content.SetSize(lineWidth, choices.length * LINE_HEIGHT);
        this.scroll.SetSize(lineWidth, shownHeight);
        this.scroll.SetVerticalScroll(0);
        updateScrollBar(this.scroll, choices.length * LINE_HEIGHT);
        this.frame.SetSize(lineWidth + 2 * PADDING + barWidth, shownHeight + 2 * PADDING);
        this.frame.Show();
        this.frame.Raise();
    }

    private createLine(index: number): ChoiceLine {
        const button = CreateFrame("Button", undefined, this.content);
        button.SetHeight(LINE_HEIGHT);
        button.SetPoint("TOPLEFT", this.content, "TOPLEFT", 0, -index * LINE_HEIGHT);
        button.SetHighlightTexture("Interface\\QuestFrame\\UI-QuestTitleHighlight", "ADD");
        const check = button.CreateTexture(undefined, "ARTWORK");
        check.SetTexture("Interface\\Buttons\\UI-CheckBox-Check");
        check.SetSize(CHECK_SIZE, CHECK_SIZE);
        check.SetPoint("LEFT", button, "LEFT", 2, 0);
        const label = button.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        label.SetPoint("LEFT", button, "LEFT", CHECK_SIZE + 6, 0);
        label.SetJustifyH("LEFT");
        const line = { button, check, label };
        this.lines.push(line);
        return line;
    }
}

/** A dark brown box with a thin bronze border, over the windows. */
function createListFrame(): Frame {
    const [didSucceed, created] = pcall(() => CreateFrame("Frame", undefined, UIParent, "BackdropTemplate"));
    const frame = didSucceed ? (created as Frame) : CreateFrame("Frame", undefined, UIParent);
    frame.SetFrameStrata("FULLSCREEN_DIALOG");
    frame.SetClampedToScreen(true);
    // Clicks on the list stay on it
    frame.EnableMouse(true);
    const background = frame.CreateTexture(undefined, "BACKGROUND");
    background.SetPoint("TOPLEFT", frame, "TOPLEFT", 3, -3);
    background.SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", -3, 3);
    background.SetColorTexture(0.1, 0.07, 0.04, 0.95);
    if (didSucceed) {
        const backdrop = created as Frame & BackdropFrame;
        backdrop.SetBackdrop({
            edgeFile: "Interface\\Tooltips\\UI-Tooltip-Border",
            edgeSize: 14,
            insets: { left: 3, right: 3, top: 3, bottom: 3 },
        });
        backdrop.SetBackdropBorderColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    }
    return frame;
}
