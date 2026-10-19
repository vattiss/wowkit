// The window with the table of looks: one row for each kind of reminder (its default look) and one for each spell of the
// player's class (a look of its own where the player changed it, else the kind's). A row shows the color, the opacity of
// the glow in percent, whether a message says so, and the sound; a click or an entry changes it. Opened by /gb and by
// the button on the Settings page. Like the Settings page, this folder may call the game.
import { OnEvent } from "@wowkit/core";
import { SOUNDS, type MessagesService } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { StyleOverride } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import {
    BRONZE_TEXT,
    COLUMN,
    HEADER_HEIGHT,
    ICON_SIZE,
    OVERRIDDEN_COLOR,
    ROW_HEIGHT,
    STRIPE_ALPHA,
    STRIPE_COLOR,
    WINDOW_WIDTH,
} from "./style-table.constants";
import type { StyleWindowService } from "./style-window.service";
import type { StyleChoicesService } from "./style-choices.service";
import { KIND_TEXTS, type StyleRow, type StyleRowsService } from "./style-rows.service";

/** The widgets of one row; the table has as many as its longest list and reuses them. */
interface RowWidgets {
    frame: Frame;
    /** The background of every second row, lighter, so the rows tell apart. */
    stripe: Texture;
    icon: Texture;
    name: FontString;
    kind: FontString;
    swatch: Button;
    swatchColor: Texture;
    opacity: EditBox;
    message: CheckButton;
    sound: Button;
    reset: Button;
    /** What the row shows now. */
    row: StyleRow | undefined;
}

export class StyleTableService {
    private window: Frame | undefined;
    private content: Frame | undefined;
    private readonly widgets: RowWidgets[] = [];
    private readonly headers: FontString[] = [];
    private usedWidgets = 0;
    private usedHeaders = 0;

    constructor(
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
        private readonly rows: StyleRowsService,
        private readonly messages: MessagesService,
        private readonly choices: StyleChoicesService,
        private readonly windows: StyleWindowService,
    ) {}

    /** Opens the window, or closes it when it is open. A failure is printed, never thrown. */
    toggle(): void {
        const [didSucceed, error] = pcall(() => this.toggleWindow());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    /** A look changed (here or elsewhere): the rows show it. */
    @OnEvent("setting.changed")
    refreshAfterChange(key: string): void {
        if (this.window?.IsShown() === true && (key === "styles" || key === "spellStyles")) this.showRows();
    }

    private toggleWindow(): void {
        if (this.window === undefined) {
            const created = this.windows.createWindow();
            this.window = created.window;
            this.content = created.content;
        }
        if (this.window.IsShown()) {
            this.window.Hide();
            return;
        }
        this.showRows();
        this.window.Show();
    }

    /** Lays out the two lists: a header, the kinds, a header, the spells. */
    private showRows(): void {
        const content = this.content;
        if (content === undefined) return;
        this.usedWidgets = 0;
        this.usedHeaders = 0;
        let y = this.drawSection(content, "HDR_TABLE_DEFAULTS", this.rows.listKindRows(), 0);
        y = this.drawSection(content, "HDR_TABLE_SPELLS", this.rows.listSpellRows(), y);
        for (let i = this.usedHeaders; i < this.headers.length; i++) this.headers[i]!.Hide();
        for (let i = this.usedWidgets; i < this.widgets.length; i++) this.widgets[i]!.frame.Hide();
        content.SetHeight(math.max(10, y));
    }

    /** A header and a row for each entry, from `top` down; returns where the next section starts. */
    private drawSection(content: Frame, headerText: TextKey, rows: StyleRow[], top: number): number {
        const header = this.takeHeader(content);
        header.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -top);
        header.SetText(this.locale.getText(headerText));
        header.Show();
        let y = top + HEADER_HEIGHT;
        for (const row of rows) {
            const widgets = this.takeWidgets(content);
            widgets.row = row;
            widgets.frame.ClearAllPoints();
            widgets.frame.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y);
            widgets.frame.Show();
            this.fill(widgets, row);
            widgets.stripe.SetColorTexture(
                STRIPE_COLOR[0],
                STRIPE_COLOR[1],
                STRIPE_COLOR[2],
                this.usedWidgets % 2 === 0 ? STRIPE_ALPHA : 0,
            );
            y += ROW_HEIGHT;
        }
        return y + 10;
    }

    private takeHeader(content: Frame): FontString {
        let header = this.headers[this.usedHeaders];
        if (header === undefined) {
            header = content.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
            this.headers.push(header);
        }
        this.usedHeaders += 1;
        header.ClearAllPoints();
        return header;
    }

    private takeWidgets(content: Frame): RowWidgets {
        let widgets = this.widgets[this.usedWidgets];
        if (widgets === undefined) {
            widgets = this.createWidgets(content);
            this.widgets.push(widgets);
        }
        this.usedWidgets += 1;
        return widgets;
    }

    /** What a row shows: the look of its kind or spell, and whether it is the player's own. */
    private fill(widgets: RowWidgets, row: StyleRow): void {
        const style = this.styles.getStyle(row.kind, row.spellId);
        const isOverridden = this.styles.isOverridden(row.kind, row.spellId);
        widgets.icon.SetShown(row.iconId !== undefined);
        // The client takes an icon's file ID as well as a path; the typing knows only the path
        if (row.iconId !== undefined) widgets.icon.SetTexture(row.iconId as unknown as string);
        widgets.name.SetText(row.label);
        const [r, g, b] = isOverridden && row.spellId !== undefined ? OVERRIDDEN_COLOR : [1, 1, 1];
        widgets.name.SetTextColor(r, g, b);
        widgets.kind.SetTextColor(BRONZE_TEXT[0], BRONZE_TEXT[1], BRONZE_TEXT[2]);
        widgets.kind.SetText(row.spellId !== undefined ? this.locale.getText(KIND_TEXTS[row.kind]) : "");
        widgets.swatchColor.SetColorTexture(style.color[0], style.color[1], style.color[2], 1);
        widgets.opacity.SetText(string.format("%d", style.opacity));
        widgets.message.SetChecked(style.isTextOn);
        widgets.sound.SetText(SOUNDS.find((sound) => sound.key === style.sound)?.label ?? "");
        widgets.reset.SetShown(isOverridden);
    }

    private createWidgets(content: Frame): RowWidgets {
        const frame = CreateFrame("Frame", undefined, content);
        frame.SetSize(WINDOW_WIDTH - 50, ROW_HEIGHT);
        const widgets: RowWidgets = {
            frame,
            stripe: this.createStripe(frame),
            icon: this.createIcon(frame),
            name: this.createText(frame, COLUMN.name, 160, "GameFontHighlight"),
            kind: this.createText(frame, COLUMN.kind, 88, "GameFontNormalSmall"),
            ...this.createSwatch(frame),
            opacity: this.createOpacityBox(frame),
            message: CreateFrame("CheckButton", undefined, frame, "UICheckButtonTemplate"),
            sound: CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate"),
            reset: CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate"),
            row: undefined,
        };
        this.connectSwatch(widgets);
        this.connectOpacity(widgets);
        this.connectMessage(widgets);
        this.connectSound(widgets);
        this.connectReset(widgets);
        return widgets;
    }

    private createStripe(frame: Frame): Texture {
        const stripe = frame.CreateTexture(undefined, "BACKGROUND");
        stripe.SetAllPoints(frame);
        return stripe;
    }

    private createIcon(frame: Frame): Texture {
        const icon = frame.CreateTexture(undefined, "ARTWORK");
        icon.SetSize(ICON_SIZE, ICON_SIZE);
        icon.SetPoint("LEFT", frame, "LEFT", COLUMN.icon, 0);
        return icon;
    }

    private createText(frame: Frame, x: number, width: number, font: string): FontString {
        const text = frame.CreateFontString(undefined, "OVERLAY", font);
        text.SetPoint("LEFT", frame, "LEFT", x, 0);
        text.SetWidth(width);
        text.SetJustifyH("LEFT");
        return text;
    }

    private createSwatch(frame: Frame): { swatch: Button; swatchColor: Texture } {
        const swatch = CreateFrame("Button", undefined, frame);
        swatch.SetSize(22, 16);
        swatch.SetPoint("LEFT", frame, "LEFT", COLUMN.color, 0);
        const border = swatch.CreateTexture(undefined, "BACKGROUND");
        border.SetAllPoints(swatch);
        border.SetColorTexture(0.55, 0.42, 0.2, 1);
        const swatchColor = swatch.CreateTexture(undefined, "ARTWORK");
        swatchColor.SetPoint("TOPLEFT", swatch, "TOPLEFT", 1, -1);
        swatchColor.SetPoint("BOTTOMRIGHT", swatch, "BOTTOMRIGHT", -1, 1);
        return { swatch, swatchColor };
    }

    private createOpacityBox(frame: Frame): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(36, 20);
        box.SetPoint("LEFT", frame, "LEFT", COLUMN.opacity + 6, 0);
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

    private connectOpacity(widgets: RowWidgets): void {
        const apply = () => {
            const row = widgets.row;
            const percent = tonumber(widgets.opacity.GetText());
            if (row !== undefined && percent !== undefined) {
                this.styles.changeStyle(row.kind, row.spellId, { opacity: math.max(1, math.min(100, math.floor(percent + 0.5))) });
            }
            widgets.opacity.ClearFocus();
        };
        widgets.opacity.SetScript("OnEnterPressed", apply);
        widgets.opacity.SetScript("OnEditFocusLost", apply);
        widgets.opacity.SetScript("OnEscapePressed", () => {
            const row = widgets.row;
            if (row !== undefined) widgets.opacity.SetText(string.format("%d", this.styles.getStyle(row.kind, row.spellId).opacity));
            widgets.opacity.ClearFocus();
        });
    }

    private connectMessage(widgets: RowWidgets): void {
        widgets.message.SetPoint("LEFT", widgets.frame, "LEFT", COLUMN.message, 0);
        widgets.message.SetSize(24, 24);
        widgets.message.SetScript("OnClick", () => this.change(widgets, { isTextOn: widgets.message.GetChecked() }));
    }

    /** Left click: the next sound; right click: the one before. Choosing one plays it once as a preview. */
    private connectSound(widgets: RowWidgets): void {
        widgets.sound.SetSize(136, 24);
        widgets.sound.SetPoint("LEFT", widgets.frame, "LEFT", COLUMN.sound, 0);
        widgets.sound.RegisterForClicks("LeftButtonUp", "RightButtonUp");
        widgets.sound.SetScript("OnClick", (_button, mouseButton) => {
            if (widgets.row !== undefined) this.choices.chooseNextSound(widgets.row, mouseButton === "RightButton" ? -1 : 1);
        });
    }

    private connectReset(widgets: RowWidgets): void {
        widgets.reset.SetSize(54, 22);
        widgets.reset.SetPoint("LEFT", widgets.frame, "LEFT", COLUMN.reset, 0);
        widgets.reset.SetText(this.locale.getText("BTN_RESET"));
        widgets.reset.SetScript("OnClick", () => {
            const row = widgets.row;
            if (row === undefined) return;
            if (row.spellId === undefined) this.styles.resetKind(row.kind);
            else this.styles.resetSpell(row.kind, row.spellId);
        });
    }

    private change(widgets: RowWidgets, change: StyleOverride): void {
        const row = widgets.row;
        if (row !== undefined) this.styles.changeStyle(row.kind, row.spellId, change);
    }
}
