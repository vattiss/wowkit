// The parts of the table of looks that change which spells there are: the Spell ID box of a cooldown or proc row (to fix
// the ID the addon uses for it), and the row at the end that adds a spell by its ID. Like the table, it may call the game.
import type { NoticeService, Rgb } from "@wowkit/wow";
import type { CustomCuesService } from "../glows/custom-cues.service";
import type { AddonLocale } from "../locale/locale.interface";
import { CUE_KINDS } from "../settings/settings.constants";
import { COLUMN, ROW_HEIGHT, TABLE_WIDTH, findCenteredX } from "./style-table.constants";
import { KIND_TEXTS, type StyleRow, type StyleRowsService } from "./style-rows.service";
import type { StyleService } from "../settings/style.service";
import type { CueKind } from "../settings/settings.interface";

/** What was typed is wrong: nothing was done, or something else than was asked. */
const ERROR_COLOR: Rgb = [1, 0.25, 0.2];

export class StyleEditsService {
    constructor(
        private readonly locale: AddonLocale,
        private readonly customCues: CustomCuesService,
        /** The table's own block of the shared notice: the tick clearing its lines must not take these with them. */
        private readonly notice: NoticeService,
        private readonly rows: StyleRowsService,
        private readonly styles: StyleService,
    ) {}

    /** The Spell ID box of a row; `getRow` tells which row it shows now (the rows are reused). */
    createIdBox(frame: Frame, getRow: (this: void) => StyleRow | undefined): EditBox {
        const box = this.createNumberBox(frame, findCenteredX(COLUMN.id, 58), 58, 7);
        const restore = () => {
            const row = getRow();
            box.SetText(row?.spellId !== undefined ? string.format("%d", row.spellId) : "");
        };
        const apply = () => {
            const row = getRow();
            const spellId = tonumber(box.GetText());
            if (row !== undefined && this.isIdEditable(row) && spellId !== undefined && spellId !== row.spellId) {
                this.changeId(row, spellId);
            }
            restore();
        };
        box.SetScript("OnEnterPressed", () => box.ClearFocus());
        box.SetScript("OnEditFocusLost", apply);
        box.SetScript("OnEscapePressed", () => {
            restore();
            box.ClearFocus();
        });
        return box;
    }

    /** Shows the ID of a spell's row (a kind's row has none); grayed where it cannot be changed (the ranks). */
    fillIdBox(box: EditBox, row: StyleRow): void {
        box.SetShown(row.spellId !== undefined);
        if (row.spellId !== undefined) box.SetText(string.format("%d", row.spellId));
        const isEditable = this.isIdEditable(row);
        box.SetEnabled(isEditable);
        const shade = isEditable ? 1 : 0.5;
        box.SetTextColor(shade, shade, shade);
    }

    /** A spell of the lists can be given another ID, and an added spell; a rank is the ID on the bar. */
    private isIdEditable(row: StyleRow): boolean {
        return row.listId !== undefined || row.isCustom === true;
    }

    /** The row at the end of the list: an ID, the kind (a click goes to the next one), and the button that adds it. */
    createAddRow(content: Frame): Frame {
        const frame = CreateFrame("Frame", undefined, content);
        frame.SetSize(TABLE_WIDTH, ROW_HEIGHT);
        const box = this.createNumberBox(frame, COLUMN.name.x, 90, 7);
        let kindIndex = 0;
        const kindButton = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        kindButton.SetSize(136, 24);
        kindButton.SetPoint("LEFT", frame, "LEFT", COLUMN.name.x + 110, 0);
        const showKind = () => kindButton.SetText(this.locale.getText(KIND_TEXTS[CUE_KINDS[kindIndex]!]));
        kindButton.SetScript("OnClick", () => {
            kindIndex = (kindIndex + 1) % CUE_KINDS.length;
            showKind();
        });
        showKind();
        const addButton = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        addButton.SetSize(80, 24);
        addButton.SetPoint("LEFT", frame, "LEFT", COLUMN.name.x + 262, 0);
        addButton.SetText(this.locale.getText("BTN_ADD"));
        addButton.SetScript("OnClick", () => {
            const spellId = tonumber(box.GetText());
            const added = spellId !== undefined ? this.addSpell(spellId, CUE_KINDS[kindIndex]!) : undefined;
            if (added !== undefined) {
                box.SetText("");
                kindIndex = CUE_KINDS.indexOf(added);
                showKind();
            }
            box.ClearFocus();
        });
        return frame;
    }

    /** Adds a spell, unless the client knows no spell by the ID or the table has it already; warns of a surely wrong kind. */
    /** Adds a spell; the kind it was added as, or undefined when it was not (unknown ID, listed already, surely wrong kind). */
    private addSpell(spellId: number, kind: CueKind): CueKind | undefined {
        if (!this.customCues.isKnownSpell(spellId)) {
            this.showUnknown(spellId);
            return undefined;
        }
        const name = this.styles.getSpellKey(spellId);
        if (this.isListedElsewhere(name)) {
            this.showProblem(string.format(this.locale.getText("MSG_ALREADY_LISTED"), name), ERROR_COLOR);
            return undefined;
        }
        const check = this.customCues.checkKind(spellId, kind);
        if (check.problem === undefined) {
            this.customCues.addCustom(spellId, kind);
            return kind;
        }
        if (check.rightKind === undefined) {
            this.showProblem(string.format(this.locale.getText(check.problem), name, this.locale.getText("MSG_CHOOSE_KIND")), ERROR_COLOR);
            return undefined;
        }
        this.customCues.addCustom(spellId, check.rightKind);
        const added = string.format(this.locale.getText("MSG_ADDED_AS"), this.locale.getText(KIND_TEXTS[check.rightKind]));
        this.showProblem(string.format(this.locale.getText(check.problem), name, added), ERROR_COLOR);
        return check.rightKind;
    }

    /**
     * Is a spell of this name in the table already, on another row than `except`? A spell is listed once, so a second one
     * would take the place of the first. Every ranked spell has a row of its own (old ranks are found for all): the rank rows
     * do not count.
     */
    private isListedElsewhere(name: string, except?: StyleRow): boolean {
        return this.rows
            .listSpellRows()
            .some(
                (row) =>
                    row.kind !== "rank" &&
                    row.spellId !== undefined &&
                    this.styles.getSpellKey(row.spellId) === name &&
                    !(except !== undefined && row.kind === except.kind && row.listId === except.listId && row.spellId === except.spellId),
            );
    }

    private changeId(row: StyleRow, spellId: number): void {
        const name = this.customCues.isKnownSpell(spellId) ? this.styles.getSpellKey(spellId) : undefined;
        if (name !== undefined && this.isListedElsewhere(name, row)) {
            this.showProblem(string.format(this.locale.getText("MSG_ALREADY_LISTED"), name), ERROR_COLOR);
            return;
        }
        const isChanged =
            row.isCustom === true
                ? row.spellId !== undefined && this.customCues.changeCustom(row.spellId, spellId)
                : row.listId !== undefined && this.customCues.changeOverride(row.listId, spellId);
        if (!isChanged) this.showUnknown(spellId);
    }

    private showUnknown(spellId: number): void {
        this.showProblem(string.format(this.locale.getText("MSG_UNKNOWN_SPELL"), spellId), ERROR_COLOR);
    }

    /** A problem with what was typed: a line at the top of the screen, like the messages of the reminders. */
    private showProblem(text: string, color: Rgb): void {
        this.notice.showNotice(this.styles.applyTextColor(color, text));
    }

    private createNumberBox(frame: Frame, x: number, width: number, maxLetters: number): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(width, 20);
        // The input box draws its border a little to the left of where it starts
        box.SetPoint("LEFT", frame, "LEFT", x + 3, 0);
        box.SetAutoFocus(false);
        box.SetNumeric(true);
        box.SetMaxLetters(maxLetters);
        return box;
    }
}
