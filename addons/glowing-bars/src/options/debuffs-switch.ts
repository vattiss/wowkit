// The switch at the top of the Debuffs tab (beta), as on the Proc rules tab: off, no debuff is reminded of, and all under it is
// faded and cannot be changed (a cover over it takes the clicks, and says why). Its words say what the reminder does: only
// the enemy targeted is looked at, never the player.
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService } from "../settings/settings.interface";

/** The height of the switch and its words, with the gap under them. */
const SWITCH_HEIGHT = 56;
/** How faded what is under the switch shows while it is off: as the rules of the Proc rules tab. */
const FADED_ALPHA = 0.45;
/** How far over the rows the cover is drawn: over their boxes and buttons. */
const COVER_LEVELS = 100;

export class DebuffsSwitch {
    private holder: Frame | undefined;
    private box: CheckButton | undefined;
    /** Takes the clicks on the faded rows. */
    private cover: Frame | undefined;
    /** The content whose parts are faded now; undefined while nothing is. */
    private fadedContent: Frame | undefined;

    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
    ) {}

    /** The switch at `top` of the content, `left` in, this wide; returns where it ends. */
    draw(content: Frame, top: number, left: number, width: number): number {
        const holder = this.holder ?? this.create(content);
        holder.ClearAllPoints();
        holder.SetPoint("TOPLEFT", content, "TOPLEFT", left, -top);
        holder.SetSize(width, SWITCH_HEIGHT);
        this.box!.SetChecked(this.settings.get("shouldUseDebuffs"));
        holder.Show();
        return top + SWITCH_HEIGHT;
    }

    /** Out of sight, and nothing faded any more: the rows and headers are the table's, shared by every tab. */
    hide(): void {
        this.holder?.Hide();
        this.cover?.Hide();
        if (this.fadedContent !== undefined) applyAlpha(this.fadedContent, undefined, 1);
        this.fadedContent = undefined;
    }

    /** While the switch is off, all the tab drew on the content under it, down to `bottom`, is faded and cannot be changed. */
    applyFade(content: Frame, bottom: number): void {
        if (this.settings.get("shouldUseDebuffs") || this.holder === undefined) return;
        applyAlpha(content, this.holder, FADED_ALPHA);
        this.fadedContent = content;
        const cover = this.cover ?? this.createCover(content);
        cover.ClearAllPoints();
        cover.SetPoint("TOPLEFT", this.holder, "BOTTOMLEFT", 0, 0);
        cover.SetPoint("RIGHT", this.holder, "RIGHT", 0, 0);
        cover.SetHeight(math.max(1, bottom - SWITCH_HEIGHT));
        cover.SetFrameLevel(content.GetFrameLevel() + COVER_LEVELS);
        cover.Show();
    }

    /** The cover over the faded rows: the clicks stop there, and its tip says how to change them. */
    private createCover(content: Frame): Frame {
        const cover = CreateFrame("Frame", undefined, content);
        cover.EnableMouse(true);
        cover.SetScript("OnEnter", () => {
            GameTooltip.SetOwner(cover, "ANCHOR_CURSOR");
            GameTooltip.SetText(this.locale.getText("TIP_DEBUFFS_OFF"), 1, 1, 1, 1, true);
            GameTooltip.Show();
        });
        cover.SetScript("OnLeave", () => GameTooltip.Hide());
        this.cover = cover;
        return cover;
    }

    private create(content: Frame): Frame {
        const holder = CreateFrame("Frame", undefined, content);
        this.holder = holder;
        const box = CreateFrame("CheckButton", undefined, holder, "UICheckButtonTemplate");
        box.SetSize(24, 24);
        box.SetPoint("TOPLEFT", holder, "TOPLEFT", 0, 0);
        box.SetScript("OnClick", () => this.settings.change("shouldUseDebuffs", box.GetChecked()));
        this.box = box;
        const title = holder.CreateFontString(undefined, "OVERLAY", "GameFontNormal");
        title.SetPoint("TOPLEFT", holder, "TOPLEFT", 30, -4);
        title.SetText(this.locale.getText("OPT_USE_DEBUFFS"));
        const info = holder.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        info.SetPoint("TOPLEFT", holder, "TOPLEFT", 30, -24);
        info.SetPoint("RIGHT", holder, "RIGHT", 0, 0);
        info.SetJustifyH("LEFT");
        info.SetText(this.locale.getText("INFO_USE_DEBUFFS"));
        return holder;
    }
}

/** The opacity of the content's frames and texts (the headers), but the one kept as it is (the switch). */
function applyAlpha(content: Frame, kept: Frame | undefined, alpha: number): void {
    for (const child of [...content.GetChildren()]) if (child !== kept) child.SetAlpha(alpha);
    for (const region of [...content.GetRegions()]) region.SetAlpha(alpha);
}
