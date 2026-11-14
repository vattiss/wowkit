// The line under the defaults of a tab that names the spells whose own default the change of their type took over (Shield
// Block in combat only, its type now Always), so the player knows to press Reset on them to keep their own. It goes once
// none is left: reset, or set on the spell itself.
import type { AddonLocale } from "../locale/locale.interface";

/** The warning icon of the game's dialogs. */
const ALERT_ICON = "Interface\\DialogFrame\\UI-Dialog-Icon-AlertNew";
const ICON_SIZE = 18;
/** Room for two lines of the small text. */
const NOTICE_HEIGHT = 32;
const TEXT_LEFT = 30;

export class TakenOverNotice {
    private frame: Frame | undefined;
    private text: FontString | undefined;

    constructor(private readonly locale: AddonLocale) {}

    /** The line at `top`, naming `names`, as wide as the table; returns where the next thing goes. None: nothing is shown. */
    draw(content: Frame, top: number, width: number, names: string[]): number {
        if (names.length === 0) {
            this.hide();
            return top;
        }
        const frame = this.frame ?? this.create(content);
        frame.ClearAllPoints();
        frame.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -top);
        frame.SetSize(width, NOTICE_HEIGHT);
        this.text!.SetWidth(width - TEXT_LEFT - 8);
        const textKey = names.length === 1 ? "TEXT_TAKEN_OVER_ONE" : "TEXT_TAKEN_OVER_MANY";
        this.text!.SetText(string.format(this.locale.getText(textKey), names.join(", ")));
        frame.Show();
        return top + NOTICE_HEIGHT + 6;
    }

    hide(): void {
        this.frame?.Hide();
    }

    private create(content: Frame): Frame {
        const frame = CreateFrame("Frame", undefined, content);
        const icon = frame.CreateTexture(undefined, "ARTWORK");
        icon.SetTexture(ALERT_ICON);
        icon.SetSize(ICON_SIZE, ICON_SIZE);
        icon.SetPoint("LEFT", frame, "LEFT", 6, 0);
        const text = frame.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        text.SetPoint("LEFT", frame, "LEFT", TEXT_LEFT, 0);
        text.SetJustifyH("LEFT");
        this.frame = frame;
        this.text = text;
        return frame;
    }
}
