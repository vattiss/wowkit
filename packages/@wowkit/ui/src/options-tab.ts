// One tab of the addon's settings window: its rows, one under the other. A row can depend on the state of the addon, so
// every row is looked at again whenever the tab is shown or something on it changes.
import { BORDER_COLOR } from "./window-frame";

const ROW_HEIGHT = 30;
/** A section's title, with a bronze line above it that sets it apart from the one before. */
const HEADER_HEIGHT = 46;
/** A box stands out this far around its rows. */
const BOX_MARGIN = 10;
/** The icon before a title. */
const ICON_SIZE = 20;
const DIVIDER_HEIGHT = 24;
/** A title at the top of a box, with its line under it. */
const BOX_HEADER_HEIGHT = 34;
/** The ground of a box: a lighter brown than the window's. */
const BOX_COLOR: [r: number, g: number, b: number] = [0.2, 0.14, 0.08];
const SUBHEADER_HEIGHT = 28;
const INDENT = 24;
/** The rows stand in a little from the edges of the tab. */
const SIDE_PADDING = 20;
/** Where the controls of the rows start. */
export const CONTROL_LEFT = 340;
const TEXT_WHITE = 1;
const TEXT_GREY = 0.5;
/** Under a text, before the next row. */
const TEXT_GAP = 10;
/** A text the game cannot measure is taken as one line. */
const LINE_HEIGHT = 14;

/** What a control does in its row. */
export interface OptionControl {
    /** The name it is found by, unique in the addon; undefined for one that only does something (a button). */
    variable?: string;
    /** What it does, from the player's click or a test. */
    apply: (this: void, value?: unknown) => void;
    /** Shows the current value. */
    refresh?: (this: void) => void;
    setEnabled: (this: void, isEnabled: boolean) => void;
    /** Goes back to its default, for the Defaults button of the tab. */
    reset?: (this: void) => void;
}

/** A row, to say when it counts. */
export interface OptionRow {
    /** Grey, and not usable, while this says no. */
    enableWhen(isEnabled: (this: void) => boolean): OptionRow;
    /** Not there at all while this says no. */
    showWhen(isShown: (this: void) => boolean): OptionRow;
    /** Set in under the row above, which it depends on. */
    setIndented(): OptionRow;
}

interface RowEntry {
    frame: Frame;
    label?: FontString;
    /** Brings the row up to date before it is placed (a text's words and height). */
    update?: (this: void) => void;
    height: number;
    control?: OptionControl;
    isEnabled?: (this: void) => boolean;
    isShown?: (this: void) => boolean;
    isIndented?: boolean;
    /** Where a box begins (its frame) or ends. */
    box?: Frame;
    isBoxEnd?: boolean;
}

/** What a row's frame carries for finding it. */
interface OptionFrame extends Frame {
    optionVariable?: string;
    optionLabel?: string;
    applyOption?: (this: void, value?: unknown) => void;
}

export class OptionsTab {
    readonly content: Frame;
    private readonly rows: RowEntry[] = [];
    private readonly labels = new LuaMap<Frame, FontString>();

    private readonly width: number;

    /** A row at the bottom left of the window, shown with the tab; made when the page asks for one. */
    private footer: Frame | undefined;
    private readonly footerControls: OptionControl[] = [];
    /** Told the tab's new height after each refresh: the window shows its scroll bar only when it is needed. */
    private noteHeight: ((this: void, height: number) => void) | undefined;
    /** Between startHighlight and stopHighlight: a title there needs no line, the box sets it apart. */
    private isInBox = false;

    constructor(
        parent: Frame,
        readonly title: string,
        contentWidth: number,
        /** The window: where the footer goes. */
        private readonly footerParent: Frame,
        /** Does the window's Defaults button count for this tab? */
        readonly hasDefaults: boolean,
    ) {
        this.width = contentWidth - SIDE_PADDING * 2;
        this.content = CreateFrame("Frame", undefined, parent);
        this.content.SetSize(contentWidth, 1);
        this.content.Hide();
    }

    /** The tab, and its footer, on the screen or not. */
    setShown(isShown: boolean): void {
        this.content.SetShown(isShown);
        this.footer?.SetShown(isShown);
    }

    /** The label of a row made with createRow, for a control that places it itself. */
    findLabel(row: Frame): FontString | undefined {
        return this.labels.get(row);
    }

    /** How wide a row is. */
    getRowWidth(): number {
        return this.width;
    }

    /** The footer row, to put a control in: in the middle at the bottom of the window, apart from the rows above. */
    createFooterRow(): Frame {
        this.footer ??= CreateFrame("Frame", undefined, this.footerParent);
        // In the middle at the bottom: its control sets its width
        this.footer.SetSize(this.width, ROW_HEIGHT);
        this.footer.SetPoint("BOTTOM", this.footerParent, "BOTTOM", 0, 12);
        this.footer.SetShown(this.content.IsShown());
        return this.footer;
    }

    /** What the control of the footer does, as addControl for a row. */
    addFooterControl(control: OptionControl): void {
        this.footerControls.push(control);
        const frame = this.footer as OptionFrame;
        frame.optionVariable = control.variable;
        frame.applyOption = control.apply;
    }

    /** Who is told the tab's height after each refresh. */
    useHeightListener(noteHeight: (this: void, height: number) => void): void {
        this.noteHeight = noteHeight;
    }

    hasRows(): boolean {
        return this.rows.length > 0;
    }

    /** A section's title; `icon` (a texture) goes before it, for the part that matters most. */
    addHeader(text: string, icon?: string): void {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, HEADER_HEIGHT);
        // In a box the title comes first, at its top, with the line under it; elsewhere the line sets it apart from above
        const height = this.isInBox ? BOX_HEADER_HEIGHT : HEADER_HEIGHT;
        frame.SetHeight(height);
        const lineY = this.isInBox ? -BOX_HEADER_HEIGHT + 6 : -10;
        const line = frame.CreateTexture(undefined, "ARTWORK");
        line.SetPoint("TOPLEFT", frame, "TOPLEFT", 0, lineY);
        line.SetPoint("TOPRIGHT", frame, "TOPRIGHT", 0, lineY);
        line.SetHeight(1);
        line.SetColorTexture(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2], 0.6);
        const label = frame.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
        const textLeft = icon !== undefined ? ICON_SIZE + 6 : 0;
        if (this.isInBox) label.SetPoint("TOPLEFT", frame, "TOPLEFT", textLeft, -2);
        else label.SetPoint("BOTTOMLEFT", frame, "BOTTOMLEFT", textLeft, 6);
        if (icon !== undefined) {
            const picture = frame.CreateTexture(undefined, "ARTWORK");
            picture.SetSize(ICON_SIZE, ICON_SIZE);
            picture.SetPoint("RIGHT", label, "LEFT", -6, 0);
            picture.SetTexture(icon);
        }
        label.SetText(text);
        this.rows.push({ frame, label, height });
    }

    /** A bronze line across the tab, as the one above a section's title: ends a part that has no title of its own. */
    addDivider(): void {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, DIVIDER_HEIGHT);
        const line = frame.CreateTexture(undefined, "ARTWORK");
        line.SetPoint("LEFT", frame, "LEFT", 0, 0);
        line.SetPoint("RIGHT", frame, "RIGHT", 0, 0);
        line.SetHeight(1);
        line.SetColorTexture(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2], 0.6);
        this.rows.push({ frame, height: DIVIDER_HEIGHT });
    }

    /** The rows from here to stopHighlight stand on a lighter ground with a bronze border: what matters most on the tab. */
    startHighlight(): void {
        this.isInBox = true;
        const [isBackdrop, made] = pcall(() => CreateFrame("Frame", undefined, this.content, "BackdropTemplate"));
        const box = isBackdrop ? (made as Frame) : CreateFrame("Frame", undefined, this.content);
        box.SetFrameLevel(this.content.GetFrameLevel());
        const ground = box.CreateTexture(undefined, "BACKGROUND");
        ground.SetAllPoints(box);
        ground.SetColorTexture(BOX_COLOR[0], BOX_COLOR[1], BOX_COLOR[2], 1);
        if (isBackdrop) {
            const edged = made as Frame & BackdropFrame;
            edged.SetBackdrop({ edgeFile: "Interface\\Tooltips\\UI-Tooltip-Border", edgeSize: 14 });
            edged.SetBackdropBorderColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        }
        this.rows.push({ frame: box, box, height: BOX_MARGIN });
    }

    stopHighlight(): void {
        this.isInBox = false;
        const frame = CreateFrame("Frame", undefined, this.content);
        this.rows.push({ frame, isBoxEnd: true, height: BOX_MARGIN * 2 });
    }

    /** A smaller title inside a section, over the rows that belong together. */
    addSubheader(text: string): void {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, SUBHEADER_HEIGHT);
        const label = frame.CreateFontString(undefined, "OVERLAY", "GameFontNormal");
        label.SetPoint("BOTTOMLEFT", frame, "BOTTOMLEFT", 0, 4);
        label.SetText(text);
        this.rows.push({ frame, label, height: SUBHEADER_HEIGHT });
    }

    /** An empty row with its label and, on hover, its tooltip; the control goes in it. */
    createRow(text: string, tooltip: string | undefined): Frame {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, ROW_HEIGHT);
        const label = frame.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        label.SetPoint("LEFT", frame, "LEFT", 0, 0);
        label.SetWidth(CONTROL_LEFT - INDENT - 8);
        label.SetJustifyH("LEFT");
        label.SetText(text);
        this.labels.set(frame, label);
        (frame as OptionFrame).optionLabel = text;
        if (tooltip !== undefined) this.connectTooltip(frame, text, tooltip);
        return frame;
    }

    private connectTooltip(frame: Frame, title: string, tooltip: string): void {
        frame.EnableMouse(true);
        frame.SetScript("OnEnter", () => {
            GameTooltip.SetOwner(frame, "ANCHOR_RIGHT");
            GameTooltip.SetText(title, 1, 1, 1, 1, true);
            GameTooltip.AddLine(tooltip, undefined, undefined, undefined, true);
            GameTooltip.Show();
        });
        frame.SetScript("OnLeave", () => GameTooltip.Hide());
    }

    /** Puts a row made with createRow on the tab, with what its control does. */
    addControl(frame: Frame, control: OptionControl, height = ROW_HEIGHT): OptionRow {
        frame.SetHeight(height);
        const entry: RowEntry = { frame, label: this.labels.get(frame)!, height, control };
        this.rows.push(entry);
        (frame as OptionFrame).optionVariable = control.variable;
        (frame as OptionFrame).applyOption = control.apply;
        return this.createHandle(entry);
    }

    private createHandle(entry: RowEntry): OptionRow {
        const row: OptionRow = {
            enableWhen: (isEnabled) => {
                entry.isEnabled = isEnabled;
                return row;
            },
            showWhen: (isShown) => {
                entry.isShown = isShown;
                return row;
            },
            setIndented: () => {
                entry.isIndented = true;
                return row;
            },
        };
        return row;
    }

    /** Looks at every row again: whether it is there, where, whether it can be used, and what it says. */
    refresh(): void {
        let top = 0;
        let box: { frame: Frame; top: number } | undefined;
        for (const entry of this.rows) {
            if (entry.box !== undefined) box = { frame: entry.box, top };
            if (entry.isBoxEnd === true && box !== undefined) {
                this.setBoxBounds(box.frame, box.top, top + BOX_MARGIN);
                box = undefined;
            }
            const isShown = entry.isShown === undefined || entry.isShown();
            entry.frame.SetShown(isShown);
            if (!isShown) continue;
            entry.update?.();
            entry.frame.ClearAllPoints();
            entry.frame.SetPoint("TOPLEFT", this.content, "TOPLEFT", SIDE_PADDING + (entry.isIndented === true ? INDENT : 0), -top);
            this.refreshControl(entry);
            top += entry.height;
        }
        this.content.SetHeight(math.max(top, 1));
        this.noteHeight?.(top);
        for (const control of this.footerControls) control.refresh?.();
    }

    /** Around the rows from `top` to `bottom`, a little wider than them. */
    private setBoxBounds(box: Frame, top: number, bottom: number): void {
        box.ClearAllPoints();
        box.SetPoint("TOPLEFT", this.content, "TOPLEFT", SIDE_PADDING - BOX_MARGIN, -top);
        box.SetSize(this.width + BOX_MARGIN * 2, bottom - top);
    }

    private refreshControl(entry: RowEntry): void {
        if (entry.control === undefined) return;
        const isEnabled = entry.isEnabled === undefined || entry.isEnabled();
        entry.control.setEnabled(isEnabled);
        // The colour first: a control may give its label one of its own (the choice picked, in gold)
        const shade = isEnabled ? TEXT_WHITE : TEXT_GREY;
        entry.label?.SetTextColor(shade, shade, shade);
        entry.control.refresh?.();
    }

    /** A picture across the tab, in its middle. */
    addPicture(texture: string, width: number, height: number): void {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, height + TEXT_GAP);
        const picture = frame.CreateTexture(undefined, "ARTWORK");
        picture.SetSize(width, height);
        picture.SetPoint("TOP", frame, "TOP", 0, 0);
        picture.SetTexture(texture);
        this.rows.push({ frame, height: height + TEXT_GAP });
    }

    /** Words across the tab, as many lines as they need; `getText` is read again at every refresh. */
    addText(getText: (this: void) => string, font = "GameFontHighlight"): OptionRow {
        const frame = CreateFrame("Frame", undefined, this.content);
        const text = frame.CreateFontString(undefined, "OVERLAY", font);
        text.SetPoint("TOPLEFT", frame, "TOPLEFT", 0, 0);
        text.SetWidth(this.width);
        text.SetJustifyH("LEFT");
        text.SetWordWrap(true);
        const entry: RowEntry = { frame, height: LINE_HEIGHT + TEXT_GAP };
        entry.update = () => {
            text.SetText(getText());
            entry.height = ((text.GetStringHeight() as number | undefined) ?? LINE_HEIGHT) + TEXT_GAP;
            frame.SetSize(this.width, entry.height);
        };
        this.rows.push(entry);
        return this.createHandle(entry);
    }

    /** A row `build` fills in itself; what it returns brings the row up to date at every refresh. */
    addCustomRow(
        height: number,
        build: (this: void, row: Frame) => ((this: void) => void) | undefined,
        /** Wider than the other rows, for one that fills the tab to its right edge. */
        width = this.width,
    ): OptionRow {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(width, height);
        const entry: RowEntry = { frame, height, update: build(frame) };
        this.rows.push(entry);
        return this.createHandle(entry);
    }

    /** Every control of this tab back to its default; the other tabs are left alone. */
    resetToDefaults(): void {
        for (const entry of this.rows) entry.control?.reset?.();
        this.refresh();
    }
}
