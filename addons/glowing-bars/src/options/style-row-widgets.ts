// The widgets of a row of the table of looks: made once and reused, filled with what the row shows, and wired to change
// the look of its type or spell. The table lays the rows out (StyleTableService).
import { findSoundLabel } from "@wowkit/ui";
import { CUSTOM_SOUND_FOLDER } from "../settings/settings.constants";
import type { AddonLocale } from "../locale/locale.interface";
import type { StyleOverride } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { BRONZE_TEXT, COLUMN, findCenteredX, OVERRIDDEN_COLOR, ROW_HEIGHT, TABLE_WIDTH } from "./style-table.constants";
import { setFadeOnly } from "./fade-only-controls";
import { applyRowView, createIcon, createStripe, createText, createSwatch } from "./style-row-layout";
import type { StyleWindowService } from "./style-window.service";
import type { ChoiceButtons, StyleChoicesService } from "./style-choices.service";
import type { StyleEditsService } from "./style-edits.service";
import { TYPE_TEXTS, type StyleRow } from "./style-rows.service";

export /** The widgets of one row; the table has as many as its longest list and reuses them. */
interface RowWidgets {
    frame: Frame;
    /** The background of every second row, lighter, so the rows tell apart. */
    stripe: Texture;
    icon: Texture;
    name: FontString;
    typeText: FontString;
    swatch: Button;
    swatchColor: Texture;
    glowPercent: EditBox;
    /** The ID of a cooldown or proc: it can be fixed. */
    spellIdBox: EditBox;
    message: CheckButton;
    /** Opens the small window of the message's words and color (Advanced view). */
    messageGear: Button;
    sound: Button;
    /** The other buttons that open a list of choices: how often it repeats, when it may show, for how long, how it moves. */
    choices: ChoiceButtons;
    belowBox: EditBox;
    reset: Button;
    /** Takes out a spell the player added. */
    remove: Button;
    /** The type or the spell is on. */
    enabled: CheckButton;
    /** What the row shows now. */
    row: StyleRow | undefined;
}

export class StyleRowWidgets {
    constructor(
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
        private readonly choices: StyleChoicesService,
        private readonly windows: StyleWindowService,
        private readonly edits: StyleEditsService,
    ) {}

    /** What a row shows: the look of its type or spell, and whether it is the player's own. */
    fill(widgets: RowWidgets, row: StyleRow): void {
        const style = this.styles.getStyle(row.reminderType, row.spellId);
        const isOverridden = this.styles.isOverridden(row.reminderType, row.spellId);
        widgets.icon.SetShown(row.iconId !== undefined);
        // The client takes an icon's file ID as well as a path; the typing knows only the path
        if (row.iconId !== undefined) widgets.icon.SetTexture(row.iconId as unknown as string);
        widgets.name.SetText(row.label);
        const [r, g, b] = isOverridden && row.spellId !== undefined ? OVERRIDDEN_COLOR : [1, 1, 1];
        widgets.name.SetTextColor(r, g, b);
        widgets.typeText.SetTextColor(BRONZE_TEXT[0], BRONZE_TEXT[1], BRONZE_TEXT[2]);
        widgets.typeText.SetText(row.spellId !== undefined ? this.locale.getText(TYPE_TEXTS[row.reminderType]) : "");
        widgets.swatchColor.SetColorTexture(style.color[0], style.color[1], style.color[2], 1);
        widgets.glowPercent.SetText(string.format("%d", style.glowPercent));
        widgets.message.SetChecked(style.isMessageOn);
        widgets.sound.SetText(findSoundLabel(style.sound, CUSTOM_SOUND_FOLDER));
        this.choices.fillChoices(widgets.choices, row);
        setFadeOnly(this.listFadeOnlyControls(widgets), row.isFadeOnly === true, this.locale.getText("TIP_FADE_ONLY"));
        widgets.reset.SetShown(isOverridden);
        widgets.remove.SetShown(row.isAdded === true);
        this.edits.fillEnabled(widgets.enabled, widgets.frame, row, [widgets.icon, widgets.name]);
        this.edits.fillIdBox(widgets.spellIdBox, row);
        this.edits.fillBelowBox(widgets.belowBox, row);
        applyRowView(widgets, this.windows.getColumns(), this.windows.isAdvanced());
        this.choices.fillMessageGear(widgets.messageGear, row, this.windows.isAdvanced());
        // A group's row of the proc rules has no switch of its own: its rules are switched on the Proc rules tab
        if (row.isGroupRow === true) widgets.enabled.Hide();
    }

    createWidgets(content: Frame): RowWidgets {
        const frame = CreateFrame("Frame", undefined, content);
        frame.SetSize(TABLE_WIDTH, ROW_HEIGHT);
        // The ID box asks for the row it shows when it is used, by then the object below is there
        const widgets: RowWidgets = {
            frame,
            stripe: createStripe(frame),
            icon: createIcon(frame),
            name: createText(frame, COLUMN.name, "GameFontHighlight"),
            typeText: createText(frame, COLUMN.type, "GameFontNormalSmall"),
            ...createSwatch(frame),
            glowPercent: this.createGlowPercentBox(frame),
            message: CreateFrame("CheckButton", undefined, frame, "UICheckButtonTemplate"),
            messageGear: this.choices.createMessageGear(frame, () => widgets.row),
            sound: CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate"),
            reset: CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate"),
            remove: CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate"),
            enabled: CreateFrame("CheckButton", undefined, frame, "UICheckButtonTemplate"),
            choices: this.choices.createChoiceButtons(frame, () => widgets.row),
            spellIdBox: this.edits.createIdBox(frame, () => widgets.row),
            belowBox: this.edits.createBelowBox(frame, () => widgets.row),
            row: undefined,
        };
        this.connectSwatch(widgets);
        this.connectGlowPercent(widgets);
        this.connectMessage(widgets);
        this.connectSound(widgets);
        this.connectReset(widgets);
        this.edits.connectRemove(widgets.remove, () => widgets.row);
        this.edits.connectEnabled(widgets.enabled, () => widgets.row);
        return widgets;
    }

    /** What a glow only the game can light cannot use: all of it needs to know when the glow starts. */
    private listFadeOnlyControls(widgets: RowWidgets): Button[] {
        return [widgets.sound, widgets.choices.repeat, widgets.choices.glowTime];
    }

    private createGlowPercentBox(frame: Frame): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(36, 20);
        box.SetPoint("LEFT", frame, "LEFT", findCenteredX(COLUMN.glowPercent, 36) + 3, 0);
        box.SetAutoFocus(false);
        box.SetNumeric(true);
        box.SetMaxLetters(3);
        return box;
    }

    private connectSwatch(widgets: RowWidgets): void {
        widgets.swatch.SetScript("OnClick", () => {
            if (widgets.row !== undefined) this.choices.chooseColor(widgets.row);
        });
    }

    private connectGlowPercent(widgets: RowWidgets): void {
        const apply = () => {
            const row = widgets.row;
            const percent = tonumber(widgets.glowPercent.GetText());
            if (row !== undefined && percent !== undefined) {
                const glowPercent = math.max(1, math.min(100, math.floor(percent + 0.5)));
                this.styles.changeStyle(row.reminderType, row.spellId, { glowPercent });
            }
            widgets.glowPercent.ClearFocus();
        };
        widgets.glowPercent.SetScript("OnEnterPressed", apply);
        widgets.glowPercent.SetScript("OnEditFocusLost", apply);
        widgets.glowPercent.SetScript("OnEscapePressed", () => {
            if (widgets.row !== undefined) this.fill(widgets, widgets.row);
            widgets.glowPercent.ClearFocus();
        });
    }

    private connectMessage(widgets: RowWidgets): void {
        widgets.message.SetSize(24, 24);
        widgets.message.SetScript("OnClick", () => this.change(widgets, { isMessageOn: widgets.message.GetChecked() }));
    }

    private connectSound(widgets: RowWidgets): void {
        widgets.sound.SetSize(126, 24);
        this.choices.connectSoundMenu(widgets.sound, () => widgets.row);
    }

    private connectReset(widgets: RowWidgets): void {
        widgets.reset.SetSize(46, 22);
        widgets.reset.SetText(this.locale.getText("BTN_RESET"));
        widgets.reset.SetScript("OnClick", () => {
            const row = widgets.row;
            if (row === undefined) return;
            if (row.spellId === undefined) this.styles.resetType(row.reminderType);
            else this.styles.resetSpell(row.reminderType, row.spellId);
        });
    }

    private change(widgets: RowWidgets, change: StyleOverride): void {
        const row = widgets.row;
        if (row !== undefined) this.styles.changeStyle(row.reminderType, row.spellId, change);
    }
}
