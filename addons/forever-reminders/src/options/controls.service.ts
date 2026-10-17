// Controls for the Settings panel pages: the game's own checkboxes, dropdowns and color swatches,
// bound to the addon's settings. A control reads the setting through `get` and writes it through
// `set` (always SettingsService.change, so whoever cares reacts to "setting.changed").

import type { LocaleService } from "../locale/locale.service";
import type { TextKey } from "../locale/texts.constants";
import type { MessagesService } from "../messages/messages.service";
import { SOUNDS } from "../messages/sounds.constants";
import type { ColorKey, SoundKey } from "../settings/settings.interface";
import type { SettingsService } from "../settings/settings.service";

type FeatureFlag = "hideResting" | "showBuff" | "showWeapon" | "showBarNotice" | "showRankNotice" | "showPartyBuffs" | "showReagentNotice";

function registerProxySetting<T>(
    category: SettingsCategory,
    variable: string,
    varType: string,
    label: string,
    defaultValue: T,
    get: () => T,
    set: (value: T) => void,
) {
    return Settings.RegisterProxySetting(category, `ForeverReminders_${variable}`, varType, label, defaultValue, get, set);
}

export class ControlsService {
    constructor(
        private readonly locale: LocaleService,
        private readonly settings: SettingsService,
        private readonly messages: MessagesService,
    ) {}

    addHeader(layout: SettingsLayout, label: TextKey): void {
        layout.AddInitializer(CreateSettingsListSectionHeaderInitializer(this.locale.getText(label)));
    }

    addCheckbox(
        category: SettingsCategory,
        variable: string,
        label: string,
        tooltip: string | undefined,
        isOnByDefault: boolean,
        get: () => boolean,
        set: (isChecked: boolean) => void,
    ): void {
        Settings.CreateCheckbox(
            category,
            registerProxySetting(category, variable, Settings.VarType.Boolean, label, isOnByDefault, get, set),
            tooltip,
        );
    }

    /** A switch stored in the settings under `key`, on by default. */
    addFeatureCheckbox(category: SettingsCategory, key: FeatureFlag, label: TextKey, tooltip: TextKey): void {
        this.addCheckbox(
            category,
            key,
            this.locale.getText(label),
            this.locale.getText(tooltip),
            true,
            () => this.settings.get(key),
            (isChecked) => this.settings.change(key, isChecked),
        );
    }

    /** `items` returns [value, label] pairs; a static list is built once. */
    addDropdown(
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
        const setting = registerProxySetting(
            category,
            variable,
            Settings.VarType.String,
            this.locale.getText(label),
            defaultValue,
            get,
            set,
        );
        let cached: unknown;
        const buildOptions = () => {
            if (isStatic && cached !== undefined) return cached;
            const container = Settings.CreateControlTextContainer();
            for (const [value, text] of items()) container.Add(value, text);
            const data = container.GetData();
            if (isStatic) cached = data;
            return data;
        };
        Settings.CreateDropdown(category, setting, buildOptions, this.locale.getText(tooltip));
    }

    /** The sound of a reminder; choosing one plays it once as a preview. */
    addSoundDropdown(category: SettingsCategory, key: "soundBuff" | "soundWeapon"): void {
        this.addDropdown(
            category,
            key,
            "OPT_SOUND",
            "TIP_SOUND",
            "none",
            () => this.settings.get(key),
            (value) => {
                this.settings.change(key, value as SoundKey);
                this.messages.playAlertSound(value as SoundKey);
            },
            () => SOUNDS.map((sound): [string, string] => [sound.key, this.locale.getText(sound.label)]),
            true,
        );
    }

    /** The glow color of a reminder; skipped on clients without color swatches. */
    addColorSwatch(category: SettingsCategory, key: ColorKey, label: TextKey): void {
        const createSwatch = Settings.CreateColorSwatch;
        if (!createSwatch) return;
        const convertToHexColor = ([r, g, b]: [number, number, number]) => CreateColor(r, g, b).GenerateHexColor();
        const setting = registerProxySetting(
            category,
            `color_${key}`,
            Settings.VarType.String,
            this.locale.getText(label),
            convertToHexColor(this.settings.getDefaultColor(key)),
            () => convertToHexColor(this.settings.getColor(key)),
            (value) => {
                const picked = CreateColorFromHexString(value);
                if (!picked) return;
                this.settings.change("colors", { ...this.settings.get("colors"), [key]: [picked.r, picked.g, picked.b] });
            },
        );
        createSwatch(category, setting);
    }
}
