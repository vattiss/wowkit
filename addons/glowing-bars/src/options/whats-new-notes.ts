// The notes of the versions on the What's New tab: the versions on the left, the notes of the one picked on the right.
import { applyScrollBarTint, updateScrollBar } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import { RELEASE_NOTES } from "../changelog/release-notes.generated";
import { BORDER_COLOR } from "./style-table.constants";

const LIST_WIDTH = 110;
/** The list stands in this far, so it is as far from the window's left edge as the notes are from its right one. */
const LEFT_INSET = 4;
const VERSION_HEIGHT = 22;
/** Between the list and the notes: its scroll bar and a margin. */
const LIST_GAP = 36;
/** Inside the notes' ground, around the words. */
const TEXT_PADDING = 10;
/** What a long text gives up on its right for its scroll bar. */
const SCROLL_BAR_ROOM = 24;
/** The version picked, in the game's gold; the others white. */
const PICKED_COLOR: [number, number, number] = [1, 0.82, 0];
/** The list of versions stands on a lighter brown than the window's, with a bronze line beside it. */
const LIST_BACKGROUND: [number, number, number] = [0.17, 0.12, 0.07];
/** The notes stand on a darker brown, so they read as a page of their own. */
const TEXT_BACKGROUND: [number, number, number] = [0.06, 0.04, 0.02];

/** Fills `row`, as wide and high as it is; returns what brings it up to date. */
export function buildNotesView(row: Frame, locale: AddonLocale, width: number, height: number): (this: void) => void {
    // As far from the right edge of its ground as from the left; narrower only for the scroll bar of a long text
    const fullWidth = width - LEFT_INSET - LIST_WIDTH - LIST_GAP - TEXT_PADDING;
    const buttons: Button[] = [];
    let picked = RELEASE_NOTES[0]?.version;
    const text = createTextArea(row, fullWidth, height);
    const showVersion = () => {
        const note = RELEASE_NOTES.find((candidate) => candidate.version === picked) ?? RELEASE_NOTES[0];
        if (note === undefined) return;
        text.label.SetText(`|cffffd100${locale.getText("TITLE")} ${note.version}|r  |cff999999${note.date}|r\n\n${note.text}`);
        const textHeight = measureFittedText(text, fullWidth, height - TEXT_PADDING * 2);
        text.content.SetHeight(textHeight);
        updateScrollBar(text.scroll, textHeight);
        RELEASE_NOTES.forEach((candidate, index) => {
            const [r, g, b] = candidate === note ? PICKED_COLOR : [1, 1, 1];
            buttons[index]?.GetFontString()?.SetTextColor(r, g, b);
        });
    };
    createVersionList(row, height, buttons, (version) => {
        picked = version;
        showVersion();
    });
    return showVersion;
}

/** The words across the whole width when they fit, else beside the scroll bar; returns their height. */
function measureFittedText(
    text: { label: FontString; content: Frame; scroll: ScrollFrame },
    fullWidth: number,
    areaHeight: number,
): number {
    const measure = (textWidth: number) => {
        text.scroll.SetWidth(textWidth);
        text.content.SetWidth(textWidth);
        text.label.SetWidth(textWidth);
        return ((text.label.GetStringHeight() as number | undefined) ?? 0) + 20;
    };
    const height = measure(fullWidth);
    return height > areaHeight ? measure(fullWidth - SCROLL_BAR_ROOM) : height;
}

/** The versions, newest first, in a list of their own that scrolls. */
function createVersionList(row: Frame, height: number, buttons: Button[], pick: (this: void, version: string) => void): void {
    // Above the window's own background, under the list
    const background = row.CreateTexture(undefined, "BORDER");
    background.SetPoint("TOPLEFT", row, "TOPLEFT", LEFT_INSET, 0);
    background.SetSize(LIST_WIDTH + 30, height);
    background.SetColorTexture(LIST_BACKGROUND[0], LIST_BACKGROUND[1], LIST_BACKGROUND[2], 1);
    const line = row.CreateTexture(undefined, "BORDER");
    line.SetPoint("TOPLEFT", background, "TOPRIGHT", 0, 0);
    line.SetPoint("BOTTOMLEFT", background, "BOTTOMRIGHT", 0, 0);
    line.SetWidth(1);
    line.SetColorTexture(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2], 1);
    const scroll = CreateFrame("ScrollFrame", undefined, row, "UIPanelScrollFrameTemplate");
    scroll.SetPoint("TOPLEFT", row, "TOPLEFT", LEFT_INSET + 4, -4);
    scroll.SetSize(LIST_WIDTH, height - 8);
    applyScrollBarTint(scroll);
    const list = CreateFrame("Frame", undefined, scroll);
    list.SetSize(LIST_WIDTH, RELEASE_NOTES.length * VERSION_HEIGHT);
    scroll.SetScrollChild(list);
    RELEASE_NOTES.forEach((note, index) => {
        const button = CreateFrame("Button", undefined, list);
        button.SetSize(LIST_WIDTH, VERSION_HEIGHT);
        button.SetPoint("TOPLEFT", list, "TOPLEFT", 0, -index * VERSION_HEIGHT);
        button.SetNormalFontObject((_G as unknown as { GameFontHighlight: Font }).GameFontHighlight);
        button.SetText(note.version);
        button.GetFontString()?.SetJustifyH("LEFT");
        button.GetFontString()?.SetPoint("LEFT", button, "LEFT", 6, 0);
        button.SetScript("OnClick", () => pick(note.version));
        buttons.push(button);
    });
}

/** The notes of the version picked, in a scroll area of their own. */
function createTextArea(row: Frame, textWidth: number, height: number): { label: FontString; content: Frame; scroll: ScrollFrame } {
    const ground = row.CreateTexture(undefined, "BORDER");
    ground.SetPoint("TOPLEFT", row, "TOPLEFT", LEFT_INSET + LIST_WIDTH + LIST_GAP - TEXT_PADDING, 0);
    ground.SetPoint("BOTTOMRIGHT", row, "BOTTOMRIGHT", 0, 0);
    ground.SetColorTexture(TEXT_BACKGROUND[0], TEXT_BACKGROUND[1], TEXT_BACKGROUND[2], 1);
    const scroll = CreateFrame("ScrollFrame", undefined, row, "UIPanelScrollFrameTemplate");
    scroll.SetPoint("TOPLEFT", row, "TOPLEFT", LEFT_INSET + LIST_WIDTH + LIST_GAP, -TEXT_PADDING);
    scroll.SetSize(textWidth, height - TEXT_PADDING * 2);
    applyScrollBarTint(scroll);
    const content = CreateFrame("Frame", undefined, scroll);
    content.SetSize(textWidth, 10);
    scroll.SetScrollChild(content);
    const label = content.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    label.SetPoint("TOPLEFT", content, "TOPLEFT", 0, 0);
    label.SetWidth(textWidth);
    label.SetJustifyH("LEFT");
    label.SetJustifyV("TOP");
    label.SetWordWrap(true);
    return { label, content, scroll };
}
