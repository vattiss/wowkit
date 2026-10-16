// The options page in the game's Settings panel: a landing page, the Reminders page (native
// checkboxes, dropdowns and color swatches bound to the settings) and the Debug report page.
// It only reads and changes settings (changeSetting); whoever cares reacts to settingChanged.
import { getSpellLabel } from "./api/spells";
import { getClassBuffs, isBuffEnabled, setBuffEnabled } from "./buffs";
import * as debug from "./debug";
import { getColor, getDefaultColor } from "./glow";
import { getText, say, type TextKey } from "./locale";
import { SOUNDS, playAlertSound } from "./notice";
import { changeSetting, settings, type ColorKey, type SoundKey } from "./settings";
import { attempt } from "./util/safe";
import { findAutomaticWeaponBuff, isWeaponBuffLearned, getWeaponChoices, hasOffhandChoice } from "./weapon-choice";

const GITHUB_URL = "https://github.com/vattiss/forever-reminders";
const ISSUES_URL = `${GITHUB_URL}/issues`;

let isRegistered = false;

function createButton(parent: Frame, width: number, height: number, label: string): Button {
    const created = CreateFrame("Button", undefined, parent, "UIPanelButtonTemplate");
    created.SetSize(width, height);
    created.SetText(label);
    return created;
}

/** Puts the text in the chat box, highlighted, for Ctrl+C. */
function copyText(text: string): boolean {
    const chat = ChatFrameUtil;
    const openChat = chat?.OpenChat;
    if (openChat && attempt(() => {
        openChat(text, DEFAULT_CHAT_FRAME);
        return true;
    }) === true) {
        DEFAULT_CHAT_FRAME.editBox?.HighlightText();
        say(getText("INFO_COPIED"));
        return true;
    }
    const box = (chat?.ChooseBoxForSend ? chat.ChooseBoxForSend() : undefined) ?? DEFAULT_CHAT_FRAME.editBox;
    if (!box) return false;
    if (chat?.ActivateChat) attempt(chat.ActivateChat, box);
    box.SetText(text);
    box.HighlightText();
    box.SetFocus();
    say(getText("INFO_COPIED"));
    return true;
}

/** A label, a read-only box with the URL and a Copy button. */
function createLinkRow(parent: Frame, label: TextKey, url: string): Frame {
    const row = CreateFrame("Frame", undefined, parent);
    row.SetHeight(26);
    const text = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
    text.SetPoint("LEFT", 0, 0);
    text.SetWidth(90);
    text.SetJustifyH("LEFT");
    text.SetTextColor(0.92, 0.92, 0.92);
    text.SetText(getText(label));
    const box = CreateFrame("EditBox", undefined, row, "BackdropTemplate") as EditBox & BackdropFrame;
    box.SetPoint("LEFT", text, "RIGHT", 8, 0);
    box.SetPoint("RIGHT", -72, 0);
    box.SetHeight(22);
    box.SetAutoFocus(false);
    box.SetFontObject("ChatFontSmall");
    box.SetTextInsets(6, 6, 2, 2);
    box.SetText(url);
    box.SetCursorPosition(0);
    box.SetBackdrop({
        bgFile: "Interface\\Buttons\\WHITE8x8",
        edgeFile: "Interface\\Tooltips\\UI-Tooltip-Border",
        tile: true,
        tileSize: 8,
        edgeSize: 8,
        insets: { left: 2, right: 2, top: 2, bottom: 2 },
    });
    box.SetBackdropColor(0.08, 0.08, 0.08, 0.95);
    box.SetBackdropBorderColor(0.42, 0.42, 0.42, 1);
    box.SetScript("OnEditFocusGained", (self) => self.HighlightText());
    box.SetScript("OnEscapePressed", (self) => self.ClearFocus());
    box.SetScript("OnEnterPressed", (self) => self.ClearFocus());
    const copy = createButton(row, 64, 22, getText("INFO_COPY"));
    copy.SetPoint("RIGHT", 0, 0);
    copy.SetScript("OnClick", () => {
        if (!copyText(url)) {
            box.SetFocus();
            box.HighlightText();
        }
    });
    return row;
}

// ---------------------------------------------------------------------------------------------
// Settings controls. Proxy settings read and write `settings` directly.

function registerProxySetting<T>(category: SettingsCategory, variable: string, varType: string, label: string, defaultValue: T, get: () => T, set: (value: T) => void) {
    return Settings.RegisterProxySetting(category, `ForeverReminders_${variable}`, varType, label, defaultValue, get, set);
}

function addHeader(layout: SettingsLayout, label: TextKey): void {
    layout.AddInitializer(CreateSettingsListSectionHeaderInitializer(getText(label)));
}

function addCheckbox(category: SettingsCategory, variable: string, label: string, tooltip: string | undefined, isOnByDefault: boolean, get: () => boolean, set: (isChecked: boolean) => void): void {
    Settings.CreateCheckbox(category, registerProxySetting(category, variable, Settings.VarType.Boolean, label, isOnByDefault, get, set), tooltip);
}

type FeatureFlag = "hideResting" | "showBuff" | "showWeapon" | "showBarNotice" | "showRankNotice" | "showPartyBuffs" | "showReagentNotice";

/** A switch stored as settings[key]. */
function addFeatureCheckbox(category: SettingsCategory, key: FeatureFlag, label: TextKey, tooltip: TextKey): void {
    addCheckbox(category, key, getText(label), getText(tooltip), true, () => settings[key], (isChecked) => changeSetting(key, isChecked));
}

/** `items` returns [value, label] pairs; static lists are built once. */
function addDropdown(
    category: SettingsCategory,
    variable: string,
    label: TextKey,
    tooltip: TextKey,
    defaultValue: string,
    get: () => string,
    set: (value: string) => void,
    items: () => [value: string, label: string][],
    isStatic = false,
): void {
    const setting = registerProxySetting(category, variable, Settings.VarType.String, getText(label), defaultValue, get, set);
    let cached: unknown;
    const buildOptions = () => {
        if (isStatic && cached !== undefined) return cached;
        const container = Settings.CreateControlTextContainer();
        for (const [value, text] of items()) container.Add(value, text);
        const data = container.GetData();
        if (isStatic) cached = data;
        return data;
    };
    Settings.CreateDropdown(category, setting, buildOptions, getText(tooltip));
}

function addSoundDropdown(category: SettingsCategory, key: "soundBuff" | "soundWeapon"): void {
    addDropdown(
        category,
        key,
        "OPT_SOUND",
        "TIP_SOUND",
        "none",
        () => settings[key],
        (value) => {
            changeSetting(key, value as SoundKey);
            playAlertSound(value as SoundKey);
        },
        () => SOUNDS.map((sound): [string, string] => [sound.key, getText(sound.label)]),
        true,
    );
}

function addColorSwatch(category: SettingsCategory, key: ColorKey, label: TextKey): void {
    const createSwatch = Settings.CreateColorSwatch;
    if (!createSwatch) return;
    const toHexColor = ([r, g, b]: [number, number, number]) => CreateColor(r, g, b).GenerateHexColor();
    const setting = registerProxySetting(category, `color_${key}`, Settings.VarType.String, getText(label), toHexColor(getDefaultColor(key)), () => toHexColor(getColor(key)), (value) => {
        const picked = CreateColorFromHexString(value);
        if (!picked) return;
        changeSetting("colors", { ...settings.colors, [key]: [picked.r, picked.g, picked.b] });
    });
    createSwatch(category, setting);
}

/** One checkbox per buff of the class list, labeled with the spell's name. */
function addBuffCheckboxes(category: SettingsCategory): void {
    for (const step of getClassBuffs()) {
        addCheckbox(category, `buff_${step.key}`, getSpellLabel(step.id) ?? step.key, getText("TIP_BUFF_ONE"), step.isOnByDefault, () => isBuffEnabled(step), (isChecked) => setBuffEnabled(step, isChecked));
    }
}

function addWeaponSection(category: SettingsCategory, layout: SettingsLayout): void {
    if (getWeaponChoices().length === 0) return;
    addHeader(layout, "HDR_WEAPON");
    addFeatureCheckbox(category, "showWeapon", "OPT_WEAPON", "TIP_WEAPON");
    // One pick, or one per hand for classes that coat both weapons
    const addWeaponPick = (key: "weaponBuff" | "weaponBuffOff", label: TextKey, isOffhand: boolean) => {
        addDropdown(
            category,
            key,
            label,
            "TIP_WEAPON_PICK",
            "auto",
            () => {
                const picked = getWeaponChoices().find((entry) => entry.key === settings[key]);
                return picked && isWeaponBuffLearned(picked) ? picked.key : "auto";
            },
            (value) => changeSetting(key, value !== "auto" ? value : undefined),
            () => {
                const auto = findAutomaticWeaponBuff(isOffhand);
                const autoLabel = auto ? `${getText("OPT_AUTOMATIC")} (${auto.entry.name ?? getSpellLabel(auto.entry.id) ?? auto.entry.key})` : getText("OPT_AUTOMATIC");
                const list: [string, string][] = [["auto", autoLabel]];
                for (const entry of getWeaponChoices()) {
                    if (isWeaponBuffLearned(entry)) list.push([entry.key, entry.name ?? getSpellLabel(entry.id) ?? entry.key]);
                }
                return list;
            },
        );
    };
    if (hasOffhandChoice()) {
        addWeaponPick("weaponBuff", "OPT_WEAPON_PICK_MAIN", false);
        addWeaponPick("weaponBuffOff", "OPT_WEAPON_PICK_OFF", true);
    } else {
        addWeaponPick("weaponBuff", "OPT_WEAPON_PICK", false);
    }
    addSoundDropdown(category, "soundWeapon");
    addColorSwatch(category, "weapon", "OPT_COLOR_WEAPON");
}

function registerRemindersPage(root: SettingsCategory): void {
    const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, getText("TAB_REMINDERS"));

    addHeader(layout, "HDR_CHARACTER");
    addCheckbox(category, "isMuted", getText("OPT_MUTE"), getText("TIP_MUTE"), false, () => settings.isMuted, (isChecked) => changeSetting("isMuted", isChecked));
    addFeatureCheckbox(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");

    if (getClassBuffs().length > 0) {
        addHeader(layout, "HDR_BUFFS");
        addFeatureCheckbox(category, "showBuff", "OPT_BUFF", "TIP_BUFF");
        addBuffCheckboxes(category);
        if (getClassBuffs().some((step) => step.party !== undefined)) addFeatureCheckbox(category, "showPartyBuffs", "OPT_PARTY_BUFFS", "TIP_PARTY_BUFFS");
        addSoundDropdown(category, "soundBuff");
        addColorSwatch(category, "buff", "OPT_COLOR_BUFF");
    }

    addWeaponSection(category, layout);

    addHeader(layout, "HDR_MESSAGES");
    addFeatureCheckbox(category, "showBarNotice", "OPT_BAR_NOTICE", "TIP_BAR_NOTICE");
    addFeatureCheckbox(category, "showRankNotice", "OPT_RANK_NOTICE", "TIP_RANK_NOTICE");
    if (getClassBuffs().some((step) => step.party?.groupIds !== undefined)) {
        addFeatureCheckbox(category, "showReagentNotice", "OPT_REAGENT_NOTICE", "TIP_REAGENT_NOTICE");
    }

    addHeader(layout, "HDR_DEBUG");
    addCheckbox(category, "isDebugMode", getText("OPT_DEBUG"), getText("TIP_DEBUG"), false, () => settings.isDebugMode, (isChecked) => changeSetting("isDebugMode", isChecked));
}

/** The debug report page: a text box and the Report / Clear buttons. */
function buildDebugPage(panel: Frame): void {
    const hint = panel.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    hint.SetPoint("TOPLEFT", 16, -16);
    hint.SetPoint("RIGHT", panel, "RIGHT", -24, 0);
    hint.SetJustifyH("LEFT");
    hint.SetWordWrap(true);
    hint.SetText(getText("OPT_DEBUG_HINT"));

    const scroll = CreateFrame("ScrollFrame", undefined, panel, "UIPanelScrollFrameTemplate");
    scroll.SetPoint("TOPLEFT", 16, -70);
    scroll.SetPoint("BOTTOMRIGHT", -36, 48);
    const edit = CreateFrame("EditBox", undefined, scroll);
    edit.SetMultiLine(true);
    edit.SetFontObject("ChatFontSmall");
    edit.SetWidth(580);
    edit.SetHeight(400);
    edit.SetAutoFocus(false);
    edit.EnableMouse(true);
    edit.SetMaxLetters(25000);
    edit.SetTextInsets(4, 4, 4, 4);
    edit.SetScript("OnEscapePressed", (self) => self.ClearFocus());
    scroll.SetScrollChild(edit);

    const reportButton = createButton(panel, 160, 22, getText("OPT_DEBUG_REPORT"));
    reportButton.SetPoint("BOTTOMLEFT", 16, 14);
    reportButton.SetScript("OnClick", () => {
        edit.SetText(debug.buildReport());
        edit.HighlightText();
        edit.SetFocus();
    });
    const clearButton = createButton(panel, 160, 22, getText("OPT_DEBUG_CLEAR"));
    clearButton.SetPoint("LEFT", reportButton, "RIGHT", 8, 0);
    clearButton.SetScript("OnClick", () => {
        debug.clearDebugData();
        edit.SetText("");
        say(getText("OPT_DEBUG_CLEARED"));
    });
}

/** The landing page: what the addon does, and where to report problems. */
function buildHome(home: Frame): void {
    const title = home.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
    title.SetPoint("TOPLEFT", 16, -16);
    title.SetTextColor(1, 0.82, 0.2);
    title.SetText(getText("TITLE"));
    const text = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    text.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -16);
    text.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    text.SetJustifyH("LEFT");
    text.SetWordWrap(true);
    text.SetText(getText("OPT_HOME_TEXT"));
    const help = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
    help.SetPoint("TOPLEFT", text, "BOTTOMLEFT", 0, -12);
    help.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    help.SetJustifyH("LEFT");
    help.SetWordWrap(true);
    help.SetText(getText("OPT_HOME_HELP"));
    const githubRow = createLinkRow(home, "INFO_GITHUB", GITHUB_URL);
    githubRow.SetPoint("TOPLEFT", help, "BOTTOMLEFT", 0, -16);
    githubRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    const issuesRow = createLinkRow(home, "INFO_ISSUES", ISSUES_URL);
    issuesRow.SetPoint("TOPLEFT", githubRow, "BOTTOMLEFT", 0, -4);
    issuesRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
}

export function registerOptions(): void {
    if (isRegistered || typeof Settings === "undefined") return;
    isRegistered = true;
    const home = CreateFrame("Frame");
    buildHome(home);
    const root = Settings.RegisterCanvasLayoutCategory(home, getText("TITLE"));
    Settings.RegisterAddOnCategory(root);

    registerRemindersPage(root);

    const debugPanel = CreateFrame("Frame");
    // A new frame starts shown, so the panel's first Show() would not fire OnShow
    debugPanel.Hide();
    let isBuilt = false;
    debugPanel.SetScript("OnShow", (self) => {
        if (isBuilt) return;
        isBuilt = true;
        buildDebugPage(self);
    });
    Settings.RegisterCanvasLayoutSubcategory(root, debugPanel, getText("TAB_DEBUG"));
}
