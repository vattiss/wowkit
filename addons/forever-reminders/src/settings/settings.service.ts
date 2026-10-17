// Per-character settings, saved as ForeverRemindersCharDB (## SavedVariablesPerCharacter).
//
// Player choices are changed through change(), which announces the change ("setting.changed"), so
// the options page never has to know who reacts to it. Diagnostic data (debug, blockedAction) is
// written directly with write(): nobody reacts to it.
import type { EventBus, OnAddonLoaded } from "@forever/framework";
import type { Rgb, SavedVariablesService } from "@forever/wow";
import { COLOR_DEFAULTS, createDefaultSettings } from "./settings.constants";
import type { AddonSettings, ColorKey } from "./settings.interface";

declare module "@forever/framework/event-bus" {
    interface AppEvents {
        /** A player choice changed (the key of the setting). */
        "setting.changed": [key: keyof AddonSettings];
    }
}

export class SettingsService implements OnAddonLoaded {
    /** The live settings. Its identity never changes: loading makes it the saved table. */
    private readonly values: AddonSettings = createDefaultSettings();

    constructor(
        private readonly savedVariables: SavedVariablesService,
        private readonly bus: EventBus,
    ) {}

    /** The saved values replace the defaults, as soon as the data of the addon is there. */
    onAddonLoaded(): void {
        const saved = this.savedVariables.loadTable<AddonSettings>();
        if (saved !== undefined) {
            for (const [key, value] of pairs(saved)) {
                (this.values as unknown as Record<string, unknown>)[key as string] = value;
            }
        }
        this.savedVariables.bindTable(this.values);
    }

    get<K extends keyof AddonSettings>(key: K): AddonSettings[K] {
        return this.values[key];
    }

    /**
     * Changes a player choice and announces it. Nested tables (colors, buffOn) are replaced as a
     * whole: pass a new table.
     */
    change<K extends keyof AddonSettings>(key: K, value: AddonSettings[K]): void {
        this.values[key] = value;
        this.bus.emit("setting.changed", key);
    }

    /** Writes diagnostic data; nothing is announced. */
    write<K extends keyof AddonSettings>(key: K, value: AddonSettings[K]): void {
        this.values[key] = value;
    }

    getDefaultColor(key: ColorKey): Rgb {
        return COLOR_DEFAULTS[key];
    }

    /** The glow color of a reminder: the player's choice, else the default. */
    getColor(key: ColorKey): Rgb {
        const saved = this.values.colors[key];
        if (saved !== undefined && type(saved) === "table" && tonumber(saved[0]) !== undefined) {
            return [saved[0], saved[1] ?? 0, saved[2] ?? 0];
        }
        return COLOR_DEFAULTS[key];
    }
}
