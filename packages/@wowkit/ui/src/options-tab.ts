// One tab of the addon's settings window: its rows, one under the other. A row can depend on the state of the addon, so
// every row is looked at again whenever the tab is shown or something on it changes.

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 36;
const INDENT = 24;
/** Where the controls of the rows start. */
export const CONTROL_LEFT = 340;
const TEXT_WHITE = 1;
const TEXT_GREY = 0.5;

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
    label: FontString;
    height: number;
    control?: OptionControl;
    isEnabled?: (this: void) => boolean;
    isShown?: (this: void) => boolean;
    isIndented?: boolean;
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

    constructor(
        parent: Frame,
        readonly title: string,
        private readonly width: number,
    ) {
        this.content = CreateFrame("Frame", undefined, parent);
        this.content.SetSize(width, 1);
        this.content.Hide();
    }

    hasRows(): boolean {
        return this.rows.length > 0;
    }

    /** A section's title. */
    addHeader(text: string): void {
        const frame = CreateFrame("Frame", undefined, this.content);
        frame.SetSize(this.width, HEADER_HEIGHT);
        const label = frame.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
        label.SetPoint("BOTTOMLEFT", frame, "BOTTOMLEFT", 0, 6);
        label.SetText(text);
        this.rows.push({ frame, label, height: HEADER_HEIGHT });
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
    addControl(frame: Frame, control: OptionControl): OptionRow {
        const entry: RowEntry = { frame, label: this.labels.get(frame)!, height: ROW_HEIGHT, control };
        this.rows.push(entry);
        (frame as OptionFrame).optionVariable = control.variable;
        (frame as OptionFrame).applyOption = control.apply;
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
        for (const entry of this.rows) {
            const isShown = entry.isShown === undefined || entry.isShown();
            entry.frame.SetShown(isShown);
            if (!isShown) continue;
            entry.frame.ClearAllPoints();
            entry.frame.SetPoint("TOPLEFT", this.content, "TOPLEFT", entry.isIndented === true ? INDENT : 0, -top);
            this.refreshControl(entry);
            top += entry.height;
        }
        this.content.SetHeight(math.max(top, 1));
    }

    private refreshControl(entry: RowEntry): void {
        if (entry.control === undefined) return;
        const isEnabled = entry.isEnabled === undefined || entry.isEnabled();
        entry.control.setEnabled(isEnabled);
        entry.control.refresh?.();
        const shade = isEnabled ? TEXT_WHITE : TEXT_GREY;
        entry.label.SetTextColor(shade, shade, shade);
    }

    /** Every control of this tab back to its default; the other tabs are left alone. */
    resetToDefaults(): void {
        for (const entry of this.rows) entry.control?.reset?.();
        this.refresh();
    }
}
