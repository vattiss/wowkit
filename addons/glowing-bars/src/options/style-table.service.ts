// The window with the table of looks: one row for each type of reminder (its default look) and one for each spell of the
// player's class (a look of its own where the player changed it, else the type's). A row shows the color, the glow %,
// whether a message says so, the sound and how often it repeats; a click or an entry changes it. Opened by /gb and by
// the button on the Settings page. Like the Settings page, this folder may call the game.
import { OnEvent } from "@wowkit/core";
import type { MessagesService } from "@wowkit/ui";
import { ADDABLE_TYPES } from "../settings/settings.constants";
import { TABLE_TABS, type TableTabInfo } from "./table-tabs.constants";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { StyleService } from "../settings/style.service";
import type { AddableType } from "../settings/settings.interface";
import {
    BASIC_TABLE_WIDTH,
    HEADER_HEIGHT,
    ROW_HEIGHT,
    STRIPE_ALPHA,
    STRIPE_COLOR,
    TABLE_WIDTH,
    TYPE_HEADING_HEIGHT,
} from "./style-table.constants";
import { hideHeaderTip, showHeaderTip } from "./header-tip";
import type { StyleWindowService } from "./style-window.service";
import type { StyleChoicesService } from "./style-choices.service";
import type { StyleEditsService } from "./style-edits.service";
import { TYPE_TEXTS, type StyleRow, type StyleRowsService } from "./style-rows.service";
import { StyleRowWidgets, type RowWidgets } from "./style-row-widgets";
import { TakenOverNotice } from "./taken-over-notice";
import { TableHelp } from "./table-help";

/** The words beside the switch of the spells not learned yet. */
const UNLEARNED_LABEL_WIDTH = 130;

export class StyleTableService {
    private window: Frame | undefined;
    private content: Frame | undefined;
    private readonly widgets: RowWidgets[] = [];
    private readonly headers: FontString[] = [];
    private usedWidgets = 0;
    private usedHeaders = 0;
    /** How wide the rows are now: as wide as the columns of the view. */
    private tableWidth = TABLE_WIDTH;
    /** How far in a tab with no table starts: the middle of a window wider than it (Advanced), else 0. */
    private contentLeft = 0;
    /** How tall the rows drawn last are: the scroll bar goes by it. */
    private contentHeight = 0;
    /** The row at the end that adds a spell; made with the first rows. */
    private addRow: Frame | undefined;
    /** Shows the spells not learned yet on the tab, or leaves them out; made with the first tab that has some. */
    private unlearnedSwitch: { holder: Frame; box: CheckButton } | undefined;
    /** Makes and fills the widgets of a row. */
    private readonly rowWidgets: StyleRowWidgets;
    /** The line that names the spells whose own default their type's change took over. */
    private readonly takenOver: TakenOverNotice;
    /** The help on the columns, on its own tab. */
    private readonly help: TableHelp;

    constructor(
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
        private readonly rows: StyleRowsService,
        private readonly messages: MessagesService,
        private readonly choices: StyleChoicesService,
        private readonly windows: StyleWindowService,
        private readonly edits: StyleEditsService,
    ) {
        this.rowWidgets = new StyleRowWidgets(locale, styles, choices, windows, edits);
        this.takenOver = new TakenOverNotice(locale);
        this.help = new TableHelp(locale, choices);
    }

    /** Opens the window, or closes it when it is open. A failure is printed, never thrown. */
    /** Opens or closes the table; in a fight it only closes, as EllesmereUI does with its windows. */
    toggle(): void {
        if (InCombatLockdown() && this.window?.IsShown() !== true) return this.messages.say(this.locale.getText("MSG_NOT_IN_COMBAT"));
        const [didSucceed, error] = pcall(() => this.toggleWindow());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    /** A look changed (here or elsewhere): the rows show it. */
    @OnEvent("setting.changed")
    refreshAfterChange(_key: string): void {
        // Any setting: a look, a spell added or fixed, a switch (also one changed on the Settings page)
        if (this.window?.IsShown() === true) this.showRows();
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
        // Measured again on the screen: the scroll area has its height once the window is shown
        this.windows.updateScrollBarFor(this.contentHeight);
    }

    /**
     * Lays out the tab shown: a header, its types, a header, their spells, and the row that adds one; on the sounds' tab,
     * the folders of sounds; on the help's, the columns explained. Only the tabs this character has rows on, or can add
     * to, are offered; the one picked last is shown, else the first.
     */
    private showRows(): void {
        const content = this.content;
        if (content === undefined) return;
        this.usedWidgets = 0;
        this.usedHeaders = 0;
        const spellRows = this.rows.listSpellRows();
        const typeRows = this.rows.listTypeRows(spellRows);
        // A tab with no rows of this character's is offered all the same where a spell can be added to it
        const shownTabs = TABLE_TABS.filter(
            (tab) =>
                tab.types.length === 0 ||
                typeRows.some((row) => tab.types.includes(row.reminderType)) ||
                tab.types.some((reminderType) => ADDABLE_TYPES.includes(reminderType as AddableType)),
        );
        const tab = shownTabs.find((each) => each.key === this.windows.getTab()) ?? shownTabs[0]!;
        const isInTab = (row: StyleRow) => tab.types.includes(row.reminderType);
        // The Below column only while a row of the tab has a limit
        this.windows.setBelowShown(
            typeRows.some((row) => isInTab(row) && (row.reminderType === "lowReagent" || row.reminderType === "lowStock")),
        );
        // The sounds and the help have no table: no column headers over them
        this.windows.setTableShown(tab.types.length > 0);
        // Only the low stock is of items: the other tabs name their spells alone in the headers
        this.windows.setItemsShown(tab.types.includes("lowStock"));
        this.applyTableWidth(content, tab.types.length > 0);
        this.windows.showTabs(
            shownTabs.map((each) => each.key),
            tab.key,
        );
        this.hideTabParts();
        const y =
            tab.key === "sounds"
                ? this.drawCustomSounds(content, 0)
                : tab.key === "help"
                  ? this.help.draw(content, 0, this.tableWidth, this.windows.isAdvanced(), this.contentLeft)
                  : this.drawTypeTab(
                        content,
                        tab,
                        typeRows.filter((row) => isInTab(row)),
                        spellRows.filter((row) => isInTab(row)),
                    );
        for (let i = this.usedHeaders; i < this.headers.length; i++) this.headers[i]!.Hide();
        for (let i = this.usedWidgets; i < this.widgets.length; i++) this.widgets[i]!.frame.Hide();
        content.SetHeight(math.max(10, y));
        this.contentHeight = y;
        this.windows.updateScrollBarFor(y);
    }

    /**
     * A tab of types: their rows, their spells' rows, and the row that adds a spell of these types (if any can be added). A
     * list with no rows has no header either: a tab this character has nothing on yet shows only the add row.
     */
    private drawTypeTab(content: Frame, tab: TableTabInfo, typeRows: StyleRow[], spellRows: StyleRow[]): number {
        let y = typeRows.length > 0 ? this.drawSection(content, "HDR_TABLE_DEFAULTS", typeRows, 0) : 0;
        // The spells of the lists not learned yet only when the tab is asked to list them, the switch only where there are
        // some; a spell the player added is always listed
        const isHideable = (row: StyleRow) => row.isLearned === false && row.isAdded !== true;
        const hasUnlearned = spellRows.some((row) => isHideable(row));
        const isUnlearnedShown = this.windows.isUnlearnedShown(tab.key);
        const shownRows = isUnlearnedShown ? spellRows : spellRows.filter((row) => !isHideable(row));
        // Under the defaults: the spells shown whose own default the change of their type took over
        const takenOver = shownRows.filter(
            (row) => row.spellId !== undefined && this.styles.isOwnDefaultTakenOver(row.reminderType, row.spellId),
        );
        y = this.takenOver.draw(
            content,
            y,
            this.tableWidth,
            takenOver.map((row) => row.label),
        );
        this.showUnlearnedSwitch(content, hasUnlearned ? { tab, top: y, isChecked: isUnlearnedShown } : undefined);
        if (shownRows.length > 0 || hasUnlearned) y = this.drawSection(content, "HDR_TABLE_SPELLS", shownRows, y);
        const addTypes = ADDABLE_TYPES.filter((reminderType) => tab.types.includes(reminderType));
        if (addTypes.length === 0) {
            this.addRow?.Hide();
            return y;
        }
        this.edits.useAddTypes(addTypes);
        return this.drawAddRow(content, y);
    }

    /**
     * The switch of the spells not learned yet, at the right of the spells' header (at `top`), for this tab; hidden when
     * `place` is undefined (the tab has none).
     */
    private showUnlearnedSwitch(content: Frame, place: { tab: TableTabInfo; top: number; isChecked: boolean } | undefined): void {
        if (place === undefined) {
            this.unlearnedSwitch?.holder.Hide();
            return;
        }
        const { holder, box } = this.unlearnedSwitch ?? this.createUnlearnedSwitch(content);
        holder.ClearAllPoints();
        holder.SetPoint("TOPRIGHT", content, "TOPRIGHT", 0, -place.top);
        box.SetChecked(place.isChecked);
        box.SetScript("OnClick", () => this.windows.setUnlearnedShown(place.tab.key, box.GetChecked()));
        holder.Show();
    }

    /** The switch and its words, in a frame of their own: the rows are the only frames of the list with check boxes. */
    private createUnlearnedSwitch(content: Frame): { holder: Frame; box: CheckButton } {
        const holder = CreateFrame("Frame", undefined, content);
        holder.SetSize(UNLEARNED_LABEL_WIDTH + 30, 24);
        const box = CreateFrame("CheckButton", undefined, holder, "UICheckButtonTemplate");
        box.SetSize(24, 24);
        box.SetPoint("LEFT", holder, "LEFT", 0, 0);
        const label = box.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        label.SetPoint("LEFT", box, "RIGHT", 2, 0);
        label.SetWidth(UNLEARNED_LABEL_WIDTH);
        label.SetJustifyH("LEFT");
        label.SetText(this.locale.getText("OPT_SHOW_UNLEARNED"));
        this.unlearnedSwitch = { holder, box };
        return this.unlearnedSwitch;
    }

    /** What only some tabs show, out of sight: the tab drawn shows its own again (another tab must not keep them). */
    private hideTabParts(): void {
        if (this.content !== undefined) hideHeaderTip(this.content);
        this.windows.hideCustomSounds();
        this.help.hide();
        this.takenOver.hide();
        this.addRow?.Hide();
        this.edits.useAddHeader(undefined);
        this.unlearnedSwitch?.holder.Hide();
    }

    /** The window is as wide as the columns of the view; the rows too, or as the Basic view on a tab with no table. */
    private applyTableWidth(content: Frame, hasTable: boolean): void {
        const { actions } = this.windows.getColumns();
        const viewWidth = actions.x + actions.width;
        // The window keeps the size of the view on every tab; a tab with no table (the sounds, the help) lays its words out
        // as wide as the Basic view in it
        this.tableWidth = hasTable ? viewWidth : BASIC_TABLE_WIDTH;
        // ... in the middle of it, where the window is wider (Advanced)
        this.contentLeft = (viewWidth - this.tableWidth) / 2;
        if (this.window !== undefined) this.windows.setWidthToFit(this.window, viewWidth);
        content.SetWidth(viewWidth);
    }

    /** A header and a row for each entry, from `top` down; returns where the next section starts. */
    private drawSection(content: Frame, headerText: TextKey, rows: StyleRow[], top: number): number {
        const header = this.takeHeader(content);
        header.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -top);
        header.SetText(this.locale.getText(headerText));
        header.Show();
        // What a faded name is
        if (headerText === "HDR_TABLE_SPELLS") showHeaderTip(content, top, () => this.locale.getText("TIP_TABLE_SPELLS"));
        let y = top + HEADER_HEIGHT;
        let previousType: StyleRow["reminderType"] | undefined;
        for (const row of rows) {
            if (headerText === "HDR_TABLE_SPELLS" && row.reminderType !== previousType) {
                y = this.drawTypeHeading(content, row.reminderType, y);
                previousType = row.reminderType;
            }
            const widgets = this.takeWidgets(content);
            widgets.row = row;
            widgets.frame.ClearAllPoints();
            widgets.frame.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -y);
            widgets.frame.SetWidth(this.tableWidth);
            widgets.frame.Show();
            this.rowWidgets.fill(widgets, row);
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

    /** The small heading of a type, above its spells; returns where its first row goes. */
    private drawTypeHeading(content: Frame, reminderType: StyleRow["reminderType"], top: number): number {
        const heading = this.takeHeader(content);
        heading.SetFontObject("GameFontNormalSmall");
        heading.SetPoint("TOPLEFT", content, "TOPLEFT", 6, -(top + 6));
        heading.SetText(this.locale.getText(TYPE_TEXTS[reminderType]));
        heading.Show();
        return top + TYPE_HEADING_HEIGHT;
    }

    /** The header and the row that adds a spell by its ID, at the end of the list. */
    private drawAddRow(content: Frame, top: number): number {
        const header = this.takeHeader(content);
        header.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -top);
        header.Show();
        this.addRow = this.addRow ?? this.edits.createAddRow(content);
        // Its words follow the type picked: a spell's ID, or an item's
        this.edits.useAddHeader(header);
        this.addRow.ClearAllPoints();
        this.addRow.SetPoint("TOPLEFT", content, "TOPLEFT", 0, -(top + HEADER_HEIGHT));
        this.addRow.Show();
        return top + HEADER_HEIGHT + this.edits.getAddRowHeight() + 10;
    }

    /** The header and the folders with sounds of the player's own, under the add row. */
    private drawCustomSounds(content: Frame, top: number): number {
        const header = this.takeHeader(content);
        header.SetPoint("TOPLEFT", content, "TOPLEFT", this.contentLeft, -top);
        header.SetText(this.locale.getText("HDR_CUSTOM_SOUNDS"));
        header.Show();
        return this.windows.drawCustomSounds(content, top, this.contentLeft);
    }

    private takeHeader(content: Frame): FontString {
        let header = this.headers[this.usedHeaders];
        if (header === undefined) {
            header = content.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
            this.headers.push(header);
        }
        this.usedHeaders += 1;
        header.SetFontObject("GameFontNormalLarge");
        header.ClearAllPoints();
        return header;
    }

    private takeWidgets(content: Frame): RowWidgets {
        let widgets = this.widgets[this.usedWidgets];
        if (widgets === undefined) {
            widgets = this.rowWidgets.createWidgets(content);
            this.widgets.push(widgets);
        }
        this.usedWidgets += 1;
        return widgets;
    }
}
