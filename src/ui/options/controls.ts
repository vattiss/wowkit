// Controls for the Settings panel pages: the game's own checkboxes, dropdowns and color swatches,
// bound to the addon's settings. A control reads the setting through `get` and writes it through
// `set` (always changeSetting, so whoever cares reacts to settingChanged).
import { getText, type TextKey } from "../../locale";
import { SOUNDS, playAlertSound } from "../../wow/notice";
import { changeSetting, getColor, getDefaultColor, settings, type ColorKey, type SoundKey } from "../../settings";

function registerProxySetting<T>(category: SettingsCategory, variable: string, varType: string, label: string, defaultValue: T, get: () => T, set: (value: T) => void) {
    return Settings.RegisterProxySetting(category, `ForeverReminders_${variable}`, varType, label, defaultValue, get, set);
}

export function addHeader(layout: SettingsLayout, label: TextKey): void {
    layout.AddInitializer(CreateSettingsListSectionHeaderInitializer(getText(label)));
}

export function addCheckbox(
    category: SettingsCategory,
    variable: string,
    label: string,
    tooltip: string | undefined,
    isOnByDefault: boolean,
    get: () => boolean,
    set: (isChecked: boolean) => void,
): void {
    Settings.CreateCheckbox(category, registerProxySetting(category, variable, Settings.VarType.Boolean, label, isOnByDefault, get, set), tooltip);
}

type FeatureFlag = "hideResting" | "showBuff" | "showWeapon" | "showBarNotice" | "showRankNotice" | "showPartyBuffs" | "showReagentNotice";

/** A switch stored as settings[key], on by default. */
export function addFeatureCheckbox(category: SettingsCategory, key: FeatureFlag, label: TextKey, tooltip: TextKey): void {
    addCheckbox(category, key, getText(label), getText(tooltip), true, () => settings[key], (isChecked) => changeSetting(key, isChecked));
}

/** `items` returns [value, label] pairs; a static list is built once. */
export function addDropdown(
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

/** The sound of a reminder; choosing one plays it once as a preview. */
export function addSoundDropdown(category: SettingsCategory, key: "soundBuff" | "soundWeapon"): void {
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

/** The glow color of a reminder; skipped on clients without color swatches. */
export function addColorSwatch(category: SettingsCategory, key: ColorKey, label: TextKey): void {
    const createSwatch = Settings.CreateColorSwatch;
    if (!createSwatch) return;
    const convertToHexColor = ([r, g, b]: [number, number, number]) => CreateColor(r, g, b).GenerateHexColor();
    const setting = registerProxySetting(category, `color_${key}`, Settings.VarType.String, getText(label), convertToHexColor(getDefaultColor(key)), () => convertToHexColor(getColor(key)), (value) => {
        const picked = CreateColorFromHexString(value);
        if (!picked) return;
        changeSetting("colors", { ...settings.colors, [key]: [picked.r, picked.g, picked.b] });
    });
    createSwatch(category, setting);
}
