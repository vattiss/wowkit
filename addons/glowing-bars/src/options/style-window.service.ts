// The frame of the table of looks: the classic dialog border, the title, the close button, the column headers and the
// scroll area. The rows are the table's.
import { COMMAND } from "./table-command";
import { applyScrollBarTint, connectEscape, createFrameWithBorder, createCloseButton, TabBar } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService, TableTab } from "../settings/settings.interface";
import { TABLE_TABS } from "./table-tabs.constants";
import { CustomSoundsSection } from "./custom-sounds-section";
import {
    COLUMN,
    findColumns,
    TABLE_LEFT,
    TABLE_WIDTH,
    WINDOW_HEIGHT,
    WINDOW_NAME,
    BASIC_WINDOW_WIDTH,
    findWindowWidth,
    type Column,
} from "./style-table.constants";

/** What the window leaves free of the screen's width when it has to shrink. */
const SCREEN_MARGIN = 40;
/** The tabs under the title, the column headers under them, and the rows under those. */
const TABS_TOP = 42;
const HEADERS_TOP = 78;
const ROWS_TOP = 96;
/** The least room the tabs leave at the window's sides. */
const TABS_SIDE = 22;

/** The headers that explain their column as the mouse comes over them. */
const HEADER_TIPS: { [name in keyof typeof COLUMN]?: TextKey } = {
    name: "TIP_SPELL_ITEM",
    type: "TIP_TYPE",
    id: "TIP_ID",
    color: "TIP_COLOR",
    glowPercent: "TIP_GLOW_PERCENT",
    message: "TIP_MESSAGE",
    messageLook: "TIP_MESSAGE_LOOK",
    sound: "TIP_SOUND",
    repeat: "TIP_REPEAT",
    when: "TIP_WHEN",
    glowTime: "TIP_GLOW_TIME",
    animation: "TIP_ANIMATION",
    belowLimits: "TIP_BELOW",
    enabled: "TIP_ENABLED",
    actions: "TIP_ACTIONS",
};

export class StyleWindowService {
    /** The column headers, and what each one's column is called. */
    private readonly headers: { header: FontString; hover?: Frame; column: keyof typeof COLUMN }[] = [];
    private viewButton: Button | undefined;
    private tabBar: TabBar | undefined;
    private scroll: ScrollFrame | undefined;
    /** Does the tab shown have a table (not the sounds)? Without one the column headers are left out. */
    private isTableShown = true;
    /** Does the tab shown list items too? Else the name and the ID are a spell's alone. */
    private isItemsShown = true;
    private customSounds: CustomSoundsSection | undefined;
    private hasBelow = false;

    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
    ) {}

    /** Does the table show every column, not only the ones everybody needs? */
    isAdvanced(): boolean {
        return this.settings.get("isTableAdvanced");
    }

    /** The tab the table is on: the one picked last. */
    getTab(): TableTab {
        return this.settings.get("tableTab");
    }

    /** Does this tab list the spells not learned yet too? */
    isUnlearnedShown(tab: TableTab): boolean {
        return this.settings.get("shownUnlearned")[tab] === true;
    }

    /** This tab lists the spells not learned yet too, or leaves them out (saved for the character). */
    setUnlearnedShown(tab: TableTab, isShown: boolean): void {
        this.settings.change("shownUnlearned", { ...this.settings.get("shownUnlearned"), [tab]: isShown });
    }

    /** The tab shown lists items too (the low stock), or spells alone: the headers of the name and the ID say so. */
    setItemsShown(isItemsShown: boolean): void {
        this.isItemsShown = isItemsShown;
    }

    /** The tab shown has a table, or not (the sounds): the column headers go with it. */
    setTableShown(isTableShown: boolean): void {
        this.isTableShown = isTableShown;
    }

    /** The tabs this character has rows on, side by side, the one shown pressed. */
    showTabs(shown: TableTab[], current: TableTab): void {
        this.tabBar?.showTabs((index) => shown.includes(TABLE_TABS[index]!.key));
        this.tabBar?.select(TABLE_TABS.findIndex((tab) => tab.key === current));
    }

    /** Does any row of the tab have a limit? Without one the Below column has no header (it keeps its place). */
    setBelowShown(hasBelow: boolean): void {
        this.hasBelow = hasBelow;
    }

    /** The folders with sounds of the player's own; returns where the next thing goes. */
    drawCustomSounds(content: Frame, top: number): number {
        this.customSounds = this.customSounds ?? new CustomSoundsSection(this.locale, this.settings);
        return this.customSounds.drawLines(content, top);
    }

    /** The folders of sounds out of sight: the table shows another tab. */
    hideCustomSounds(): void {
        this.customSounds?.hide();
    }

    /** Where the columns are now. */
    getColumns(): ReturnType<typeof findColumns> {
        return findColumns(this.isAdvanced());
    }

    /** The headers and the button say which view it is. */
    showView(window: Frame): void {
        const columns = this.getColumns();
        for (const { header, hover, column } of this.headers) {
            // The Below column stays, empty and with no header, where no row of the tab has a limit
            const isHeaderShown = this.isTableShown && (column !== "belowLimits" || this.hasBelow);
            const shown = isHeaderShown ? columns[column] : undefined;
            header.SetShown(shown !== undefined);
            hover?.SetShown(shown !== undefined);
            if (shown !== undefined) this.applyHeaderPosition(window, header, hover, shown);
            this.applyHeaderText(header, column);
        }
        this.viewButton?.SetText(this.locale.getText(this.isAdvanced() ? "BTN_BASIC" : "BTN_ADVANCED"));
    }

    /** The name and the ID are a spell's or an item's where the tab lists items too, a spell's alone elsewhere. */
    private applyHeaderText(header: FontString, column: keyof typeof COLUMN): void {
        if (column === "name") header.SetText(this.locale.getText(this.isItemsShown ? "COL_SPELL_ITEM" : "COL_SPELL"));
        else if (column === "id") header.SetText(this.locale.getText(this.isItemsShown ? "COL_SPELL_ITEM_ID" : "COL_SPELL_ID"));
    }

    private applyHeaderPosition(window: Frame, header: FontString, hover: Frame | undefined, column: Column): void {
        header.ClearAllPoints();
        header.SetPoint("TOPLEFT", window, "TOPLEFT", TABLE_LEFT + column.x, -HEADERS_TOP);
        hover?.ClearAllPoints();
        hover?.SetPoint("TOPLEFT", window, "TOPLEFT", TABLE_LEFT + column.x, -(HEADERS_TOP - 4));
    }

    /**
     * Sets the width of the window for a table this wide (one size in the Basic view, the settings window's), and shrinks it as
     * a whole on a screen too narrow for it (a large UI scale).
     */
    setWidthToFit(window: Frame, tableWidth: number): void {
        const width = this.isAdvanced() ? findWindowWidth(tableWidth) : BASIC_WINDOW_WIDTH;
        window.SetWidth(width);
        window.SetScale(math.min(1, (UIParent.GetWidth() - SCREEN_MARGIN) / width));
        this.showView(window);
    }

    /** The frame, and the frame inside its scroll area that the rows go in. */
    createWindow(): { window: Frame; content: Frame } {
        const window = createFrameWithBorder(WINDOW_NAME);
        window.SetSize(findWindowWidth(TABLE_WIDTH), WINDOW_HEIGHT);
        window.SetPoint("CENTER", UIParent, "CENTER", 0, 0);
        window.SetFrameStrata("DIALOG");
        window.SetMovable(true);
        window.EnableMouse(true);
        window.RegisterForDrag("LeftButton");
        window.SetScript("OnDragStart", () => window.StartMoving());
        window.SetScript("OnDragStop", () => window.StopMovingOrSizing());
        connectEscape(window);
        const title = window.CreateFontString(undefined, "OVERLAY", "GameFontNormalLarge");
        title.SetPoint("TOP", window, "TOP", 0, -16);
        title.SetText(this.locale.getText("TABLE_TITLE"));
        createCloseButton(window);
        this.createViewButton(window);
        this.createSettingsButton(window);
        this.addTabs(window);
        this.addColumnHeaders(window);
        const scroll = CreateFrame("ScrollFrame", undefined, window, "UIPanelScrollFrameTemplate");
        scroll.SetPoint("TOPLEFT", window, "TOPLEFT", TABLE_LEFT, -ROWS_TOP);
        scroll.SetPoint("BOTTOMRIGHT", window, "BOTTOMRIGHT", -34, 16);
        applyScrollBarTint(scroll);
        this.scroll = scroll;
        const content = CreateFrame("Frame", undefined, scroll);
        content.SetSize(TABLE_WIDTH, 10);
        scroll.SetScrollChild(content);
        // A new frame is shown; the table opens when it is asked for
        window.Hide();
        return { window, content };
    }

    /** A tab for each group of types, and the sounds; a click shows it (and the table opens on it next time). */
    private addTabs(window: Frame): void {
        const tabBar = new TabBar(window, TABS_TOP, TABS_SIDE);
        for (const tab of TABLE_TABS) {
            tabBar.addTab(this.locale.getText(tab.text), () => {
                this.settings.change("tableTab", tab.key);
                // Another tab starts at its top
                this.scroll?.SetVerticalScroll(0);
            });
        }
        this.tabBar = tabBar;
    }

    /** To the settings window, through the addon's slash command, which is what knows it; the table closes for it. */
    private createSettingsButton(window: Frame): void {
        const button = CreateFrame("Button", undefined, window, "UIPanelButtonTemplate");
        button.SetSize(80, 22);
        button.SetPoint("TOPRIGHT", window, "TOPRIGHT", -34, -9);
        button.SetText(this.locale.getText("BTN_SETTINGS"));
        button.SetScript("OnClick", () => {
            window.Hide();
            SlashCmdList[COMMAND]?.("settings", undefined as never);
        });
    }

    /** Next to the close button: it leads to the other view. */
    private createViewButton(window: Frame): void {
        const button = CreateFrame("Button", undefined, window, "UIPanelButtonTemplate");
        button.SetSize(80, 22);
        button.SetPoint("TOPRIGHT", window, "TOPRIGHT", -118, -9);
        button.SetScript("OnClick", () => this.settings.change("isTableAdvanced", !this.isAdvanced()));
        this.viewButton = button;
    }

    private addColumnHeaders(window: Frame): void {
        // The name and the type read from the left; the other headers are centered over their controls
        const columns: [name: keyof typeof COLUMN, text: TextKey, isCentered: boolean][] = [
            ["name", "COL_SPELL_ITEM", false],
            ["type", "COL_TYPE", false],
            ["id", "COL_SPELL_ITEM_ID", true],
            ["color", "COL_COLOR", true],
            ["glowPercent", "COL_GLOW_PERCENT", true],
            ["message", "COL_MESSAGE", true],
            ["messageLook", "COL_MESSAGE_LOOK", true],
            ["sound", "COL_SOUND", true],
            ["repeat", "COL_REPEAT", true],
            ["when", "COL_WHEN", true],
            ["glowTime", "COL_GLOW_TIME", true],
            ["animation", "COL_ANIMATION", true],
            ["belowLimits", "COL_BELOW", true],
            ["enabled", "COL_ENABLED", true],
            ["actions", "COL_ACTIONS", true],
        ];
        for (const [name, text, isCentered] of columns) {
            const column = COLUMN[name];
            const header = window.CreateFontString(undefined, "OVERLAY", "GameFontNormalSmall");
            header.SetPoint("TOPLEFT", window, "TOPLEFT", TABLE_LEFT + column.x, -HEADERS_TOP);
            header.SetWidth(column.width);
            header.SetJustifyH(isCentered ? "CENTER" : "LEFT");
            header.SetText(this.locale.getText(text));
            const tip = HEADER_TIPS[name];
            const hover = tip !== undefined ? this.addHeaderTooltip(window, column, tip) : undefined;
            this.headers.push({ header, hover, column: name });
        }
    }

    /** A header that explains its column as the mouse comes over it (the round buttons, for the animations). */
    private addHeaderTooltip(window: Frame, column: Column, tip: TextKey): Frame {
        const hover = CreateFrame("Frame", undefined, window);
        hover.SetPoint("TOPLEFT", window, "TOPLEFT", TABLE_LEFT + column.x, -(HEADERS_TOP - 4));
        hover.SetSize(column.width, 18);
        hover.EnableMouse(true);
        hover.SetScript("OnEnter", () => {
            GameTooltip.SetOwner(hover, "ANCHOR_TOP");
            GameTooltip.SetText(this.locale.getText(tip), 1, 1, 1, 1, true);
            GameTooltip.Show();
        });
        hover.SetScript("OnLeave", () => GameTooltip.Hide());
        return hover;
    }
}
