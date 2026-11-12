// The Welcome tab of the settings window: a word of welcome, the scan of the action bars (on a click, with its result
// kept), the choice about Blizzard's Cooldown Manager with the reload it needs, and the settings new players trip over.
import type { ControlsService, OptionsTab, WidgetsService } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";
import type { CooldownManagerSection } from "./cooldown-manager.section";
import type { WelcomeService } from "./welcome.service";

/** The addon's icon (its TOC icon), beside the greeting. */
const LOGO_TEXTURE = "Interface\\AddOns\\GlowingBars\\images\\logo";
const LOGO_SIZE = 52;
const GREETING_HEIGHT = 64;
const REPORT_ROW_HEIGHT = 30;
/** The game's own yellow "!" of its dialogs, before the title of what matters most. */
const ALERT_ICON = "Interface\\DialogFrame\\UI-Dialog-Icon-AlertNew";

/** What the tab is made with. */
export interface WelcomeTabParts {
    locale: AddonLocale;
    settings: AddonSettingsService;
    controls: ControlsService<AddonSettings>;
    widgets: WidgetsService;
    welcome: WelcomeService;
    manager: CooldownManagerSection;
}

export function buildWelcomeTab(tab: OptionsTab, parts: WelcomeTabParts): void {
    const { locale, settings, controls, widgets, welcome, manager } = parts;
    addGreeting(tab, locale);
    // In the game's gold: the one line to read before the rest
    tab.addText(() => locale.getText("WELCOME_READ"), "GameFontNormal");
    tab.addText(() => locale.getText("WELCOME_TEXT"));
    widgets.addButton(tab, locale.getText("OPT_SCAN"), locale.getText("BTN_SCAN"), () => welcome.scan(), locale.getText("TIP_SCAN"));
    tab.addText(() => welcome.getScanText()).showWhen(() => welcome.getScanText() !== "");
    addReportRow(tab, locale, welcome);
    tab.addDivider();
    // The part that decides how well the reminders work in a fight stands out
    tab.startHighlight();
    tab.addHeader(locale.getText("HDR_CHOICE"), ALERT_ICON);
    manager.addWelcomeChoice(tab);
    tab.addText(() => locale.getText("WELCOME_OTHER_MANAGERS"), "GameFontNormalSmall");
    tab.stopHighlight();
    tab.addHeader(locale.getText("HDR_CHARACTER"));
    controls.addCheckbox(
        tab,
        "welcome_quiet",
        locale.getText("OPT_STAY_QUIET_IN_TOWNS"),
        locale.getText("TIP_STAY_QUIET_IN_TOWNS"),
        false,
        () => settings.get("shouldStayQuietInTowns"),
        (isChecked) => settings.change("shouldStayQuietInTowns", isChecked),
    );
    controls.addCheckbox(
        tab,
        "welcome_afk",
        locale.getText("WELCOME_AFK_RAINBOW"),
        undefined,
        false,
        () => settings.get("isAfkRainbowOn"),
        (isChecked) => settings.change("isAfkRainbowOn", isChecked),
    );
    tab.addText(() => locale.getText("WELCOME_CLOSING"));
    tab.addText(() => locale.getText("WELCOME_TIP"), "GameFontNormalSmall");
    // At the bottom, as on the What's New tab: for the whole account
    controls.addFooterCheckbox(
        tab,
        "showWelcome",
        locale.getText("OPT_SHOW_WELCOME"),
        () => welcome.isWelcomeShown(),
        (isChecked) => welcome.setWelcomeShown(isChecked),
    );
}

/** The icon, the greeting in large letters and the addon's motto under it: words of the game's own fonts, readable at this size. */
function addGreeting(tab: OptionsTab, locale: AddonLocale): void {
    tab.addCustomRow(GREETING_HEIGHT, (row) => {
        const logo = row.CreateTexture(undefined, "ARTWORK");
        logo.SetSize(LOGO_SIZE, LOGO_SIZE);
        logo.SetPoint("LEFT", row, "LEFT", 0, 0);
        logo.SetTexture(LOGO_TEXTURE);
        const title = row.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
        title.SetPoint("TOPLEFT", logo, "TOPRIGHT", 12, -6);
        title.SetText(locale.getText("HDR_WELCOME"));
        const motto = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        motto.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -6);
        motto.SetText(locale.getText("WELCOME_MOTTO"));
        return undefined;
    });
}

/** The box with the report and the button that selects it. */
function createReportBox(row: Frame, locale: AddonLocale, onSelect: (this: void) => void): EditBox {
    const box = CreateFrame("EditBox", undefined, row, "InputBoxTemplate");
    box.SetSize(420, 20);
    box.SetPoint("LEFT", row, "LEFT", 6, 0);
    box.SetAutoFocus(false);
    box.SetScript("OnEscapePressed", () => box.ClearFocus());
    const select = CreateFrame("Button", undefined, row, "UIPanelButtonTemplate");
    select.SetSize(80, 22);
    select.SetPoint("LEFT", box, "RIGHT", 10, 0);
    select.SetText(locale.getText("BTN_SELECT"));
    select.SetScript("OnClick", () => {
        box.SetFocus();
        box.HighlightText();
        onSelect();
    });
    return box;
}

/** The report of the scan in a box, and the button that selects it: an addon cannot copy, so the player presses Ctrl+C. */
function addReportRow(tab: OptionsTab, locale: AddonLocale, welcome: WelcomeService): void {
    // Made with the first report: the tab is built at login, and most players never scan
    let box: EditBox | undefined;
    // Which report the player selected: the tip then says to press Ctrl+C, until a new scan
    let selectedReport: string | undefined;
    tab.addCustomRow(REPORT_ROW_HEIGHT, (row) => () => {
        box ??= createReportBox(row, locale, () => {
            selectedReport = welcome.getReport();
            tab.refresh();
        });
        // Set again only when it changed: setting it clears the selection the Select button just made
        if (box.GetText() !== welcome.getReport()) box.SetText(welcome.getReport());
    }).showWhen(() => welcome.getReport() !== "");
    tab.addText(
        () => locale.getText(selectedReport === welcome.getReport() ? "WELCOME_PRESS_COPY" : "WELCOME_REPORT_TIP"),
        "GameFontNormalSmall",
    ).showWhen(() => welcome.getReport() !== "");
}
