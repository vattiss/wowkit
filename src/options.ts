// The options page in the game's Settings panel: a landing page, the Reminders page (native
// checkboxes, dropdowns and color swatches bound to the settings) and the Debug report page.
// It only reads and changes settings (changeSetting); whoever cares reacts to settingChanged.
import { spellLabel } from "./api/spells";
import { classBuffs, isBuffEnabled, setBuffEnabled } from "./buffs";
import * as debug from "./debug";
import { color, colorDefault } from "./glow";
import { T, say, type TextKey } from "./locale";
import { SOUNDS, playAlertSound } from "./notice";
import { changeSetting, settings, type ColorKey, type SoundKey } from "./settings";
import { attempt } from "./util/safe";
import { autoWeaponBuff, weaponBuffLearned, weaponChoices, weaponHasOffhandChoice } from "./weapon-choice";

const GITHUB_URL = "https://github.com/vattiss/forever-reminders";
const ISSUES_URL = `${GITHUB_URL}/issues`;

let registered = false;

function button(parent: Frame, width: number, height: number, label: string): Button {
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
        say(T("INFO_COPIED"));
        return true;
    }
    const box = (chat?.ChooseBoxForSend ? chat.ChooseBoxForSend() : undefined) ?? DEFAULT_CHAT_FRAME.editBox;
    if (!box) return false;
    if (chat?.ActivateChat) attempt(chat.ActivateChat, box);
    box.SetText(text);
    box.HighlightText();
    box.SetFocus();
    say(T("INFO_COPIED"));
    return true;
}

/** A label, a read-only box with the URL and a Copy button. */
function linkRow(parent: Frame, label: TextKey, url: string): Frame {
    const row = CreateFrame("Frame", undefined, parent);
    row.SetHeight(26);
    const text = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
    text.SetPoint("LEFT", 0, 0);
    text.SetWidth(90);
    text.SetJustifyH("LEFT");
    text.SetTextColor(0.92, 0.92, 0.92);
    text.SetText(T(label));
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
    const copy = button(row, 64, 22, T("INFO_COPY"));
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

function proxy<T>(category: SettingsCategory, variable: string, varType: string, label: string, defaultValue: T, get: () => T, set: (value: T) => void) {
    return Settings.RegisterProxySetting(category, `ForeverReminders_${variable}`, varType, label, defaultValue, get, set);
}

function header(layout: SettingsLayout, label: TextKey): void {
    layout.AddInitializer(CreateSettingsListSectionHeaderInitializer(T(label)));
}

function checkbox(category: SettingsCategory, variable: string, label: string, tooltip: string | undefined, defaultValue: boolean, get: () => boolean, set: (value: boolean) => void): void {
    Settings.CreateCheckbox(category, proxy(category, variable, Settings.VarType.Boolean, label, defaultValue, get, set), tooltip);
}

type FeatureFlag = "hideResting" | "showBuff" | "showWeapon" | "showBarNotice" | "showRankNotice" | "showPartyBuffs" | "showReagentNotice";

/** A switch stored as settings[key]. */
function featureCheckbox(category: SettingsCategory, key: FeatureFlag, label: TextKey, tooltip: TextKey): void {
    checkbox(category, key, T(label), T(tooltip), true, () => settings[key], (value) => changeSetting(key, value));
}

/** `items` returns [value, label] pairs; static lists are built once. */
function dropdown(
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
    const setting = proxy(category, variable, Settings.VarType.String, T(label), defaultValue, get, set);
    let cached: unknown;
    const options = () => {
        if (isStatic && cached !== undefined) return cached;
        const container = Settings.CreateControlTextContainer();
        for (const [value, text] of items()) container.Add(value, text);
        const data = container.GetData();
        if (isStatic) cached = data;
        return data;
    };
    Settings.CreateDropdown(category, setting, options, T(tooltip));
}

function soundDropdown(category: SettingsCategory, key: "soundBuff" | "soundWeapon"): void {
    dropdown(
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
        () => SOUNDS.map((sound): [string, string] => [sound.key, T(sound.label)]),
        true,
    );
}

function colorSwatch(category: SettingsCategory, key: ColorKey, label: TextKey): void {
    const createSwatch = Settings.CreateColorSwatch;
    if (!createSwatch) return;
    const hex = ([r, g, b]: [number, number, number]) => CreateColor(r, g, b).GenerateHexColor();
    const setting = proxy(category, `color_${key}`, Settings.VarType.String, T(label), hex(colorDefault(key)), () => hex(color(key)), (value) => {
        const picked = CreateColorFromHexString(value);
        if (!picked) return;
        changeSetting("colors", { ...settings.colors, [key]: [picked.r, picked.g, picked.b] });
    });
    createSwatch(category, setting);
}

/** One checkbox per buff of the class list, labeled with the spell's name. */
function buffCheckboxes(category: SettingsCategory): void {
    for (const step of classBuffs()) {
        checkbox(category, `buff_${step.key}`, spellLabel(step.id) ?? step.key, T("TIP_BUFF_ONE"), step.onByDefault, () => isBuffEnabled(step), (value) => setBuffEnabled(step, value));
    }
}

function weaponSection(category: SettingsCategory, layout: SettingsLayout): void {
    if (weaponChoices().length === 0) return;
    header(layout, "HDR_WEAPON");
    featureCheckbox(category, "showWeapon", "OPT_WEAPON", "TIP_WEAPON");
    // One pick, or one per hand for classes that coat both weapons
    const weaponPick = (key: "weaponBuff" | "weaponBuffOff", label: TextKey, offhand: boolean) => {
        dropdown(
            category,
            key,
            label,
            "TIP_WEAPON_PICK",
            "auto",
            () => {
                const picked = weaponChoices().find((entry) => entry.key === settings[key]);
                return picked && weaponBuffLearned(picked) ? picked.key : "auto";
            },
            (value) => changeSetting(key, value !== "auto" ? value : undefined),
            () => {
                const auto = autoWeaponBuff(offhand);
                const autoLabel = auto ? `${T("OPT_AUTOMATIC")} (${auto.entry.name ?? spellLabel(auto.entry.id) ?? auto.entry.key})` : T("OPT_AUTOMATIC");
                const list: [string, string][] = [["auto", autoLabel]];
                for (const entry of weaponChoices()) {
                    if (weaponBuffLearned(entry)) list.push([entry.key, entry.name ?? spellLabel(entry.id) ?? entry.key]);
                }
                return list;
            },
        );
    };
    if (weaponHasOffhandChoice()) {
        weaponPick("weaponBuff", "OPT_WEAPON_PICK_MAIN", false);
        weaponPick("weaponBuffOff", "OPT_WEAPON_PICK_OFF", true);
    } else {
        weaponPick("weaponBuff", "OPT_WEAPON_PICK", false);
    }
    soundDropdown(category, "soundWeapon");
    colorSwatch(category, "weapon", "OPT_COLOR_WEAPON");
}

function registerRemindersPage(root: SettingsCategory): void {
    const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, T("TAB_REMINDERS"));

    header(layout, "HDR_CHARACTER");
    checkbox(category, "muted", T("OPT_MUTE"), T("TIP_MUTE"), false, () => settings.muted, (value) => changeSetting("muted", value));
    featureCheckbox(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");

    if (classBuffs().length > 0) {
        header(layout, "HDR_BUFFS");
        featureCheckbox(category, "showBuff", "OPT_BUFF", "TIP_BUFF");
        buffCheckboxes(category);
        if (classBuffs().some((step) => step.party !== undefined)) featureCheckbox(category, "showPartyBuffs", "OPT_PARTY_BUFFS", "TIP_PARTY_BUFFS");
        soundDropdown(category, "soundBuff");
        colorSwatch(category, "buff", "OPT_COLOR_BUFF");
    }

    weaponSection(category, layout);

    header(layout, "HDR_MESSAGES");
    featureCheckbox(category, "showBarNotice", "OPT_BAR_NOTICE", "TIP_BAR_NOTICE");
    featureCheckbox(category, "showRankNotice", "OPT_RANK_NOTICE", "TIP_RANK_NOTICE");
    if (classBuffs().some((step) => step.party?.groupIds !== undefined)) {
        featureCheckbox(category, "showReagentNotice", "OPT_REAGENT_NOTICE", "TIP_REAGENT_NOTICE");
    }

    header(layout, "HDR_DEBUG");
    checkbox(category, "debugMode", T("OPT_DEBUG"), T("TIP_DEBUG"), false, () => settings.debugMode, (value) => changeSetting("debugMode", value));
}

/** The debug report page: a text box and the Report / Clear buttons. */
function buildDebugPage(panel: Frame): void {
    const hint = panel.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    hint.SetPoint("TOPLEFT", 16, -16);
    hint.SetPoint("RIGHT", panel, "RIGHT", -24, 0);
    hint.SetJustifyH("LEFT");
    hint.SetWordWrap(true);
    hint.SetText(T("OPT_DEBUG_HINT"));

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

    const reportButton = button(panel, 160, 22, T("OPT_DEBUG_REPORT"));
    reportButton.SetPoint("BOTTOMLEFT", 16, 14);
    reportButton.SetScript("OnClick", () => {
        edit.SetText(debug.report());
        edit.HighlightText();
        edit.SetFocus();
    });
    const clearButton = button(panel, 160, 22, T("OPT_DEBUG_CLEAR"));
    clearButton.SetPoint("LEFT", reportButton, "RIGHT", 8, 0);
    clearButton.SetScript("OnClick", () => {
        debug.clear();
        edit.SetText("");
        say(T("OPT_DEBUG_CLEARED"));
    });
}

/** The landing page: what the addon does, and where to report problems. */
function buildHome(home: Frame): void {
    const title = home.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
    title.SetPoint("TOPLEFT", 16, -16);
    title.SetTextColor(1, 0.82, 0.2);
    title.SetText(T("TITLE"));
    const text = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    text.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -16);
    text.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    text.SetJustifyH("LEFT");
    text.SetWordWrap(true);
    text.SetText(T("OPT_HOME_TEXT"));
    const help = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
    help.SetPoint("TOPLEFT", text, "BOTTOMLEFT", 0, -12);
    help.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    help.SetJustifyH("LEFT");
    help.SetWordWrap(true);
    help.SetText(T("OPT_HOME_HELP"));
    const githubRow = linkRow(home, "INFO_GITHUB", GITHUB_URL);
    githubRow.SetPoint("TOPLEFT", help, "BOTTOMLEFT", 0, -16);
    githubRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    const issuesRow = linkRow(home, "INFO_ISSUES", ISSUES_URL);
    issuesRow.SetPoint("TOPLEFT", githubRow, "BOTTOMLEFT", 0, -4);
    issuesRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
}

export function registerOptions(): void {
    if (registered || typeof Settings === "undefined") return;
    registered = true;
    const home = CreateFrame("Frame");
    buildHome(home);
    const root = Settings.RegisterCanvasLayoutCategory(home, T("TITLE"));
    Settings.RegisterAddOnCategory(root);

    registerRemindersPage(root);

    const debugPanel = CreateFrame("Frame");
    // A new frame starts shown, so the panel's first Show() would not fire OnShow
    debugPanel.Hide();
    let built = false;
    debugPanel.SetScript("OnShow", (self) => {
        if (built) return;
        built = true;
        buildDebugPage(self);
    });
    Settings.RegisterCanvasLayoutSubcategory(root, debugPanel, T("TAB_DEBUG"));
}
