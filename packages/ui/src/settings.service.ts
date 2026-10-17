// Per-character settings, saved by the game as the global the TOC names (## SavedVariablesPerCharacter).
//
// Player choices are changed through change(), which announces the change ("setting.changed"), so the
// options page never has to know who reacts to it. Diagnostic data is written directly with write():
// nobody reacts to it. The shape of the settings is the addon's: `SettingsService<MySettings>`.
import type { EventBus, OnAddonLoaded } from "@wowkit/framework";
import type { SavedVariablesService } from "@wowkit/wow";

declare module "@wowkit/framework/event-bus" {
    interface AppEvents {
        /** A player choice changed (the key of the setting). */
        "setting.changed": [key: string];
    }
}

export class SettingsService<T extends object> implements OnAddonLoaded {
    /** The live settings. Its identity never changes: loading makes it the saved table. */
    private readonly values: T;

    constructor(
        private readonly savedVariables: SavedVariablesService,
        private readonly bus: EventBus,
        /** Makes the settings of a player who has none saved yet. */
        private readonly createDefaults: () => T,
    ) {
        this.values = createDefaults();
    }

    /** The saved values replace the defaults, as soon as the data of the addon is there. */
    onAddonLoaded(): void {
        const saved = this.savedVariables.loadTable<T>();
        if (saved !== undefined) {
            for (const [key, value] of pairs(saved)) {
                (this.values as Record<string, unknown>)[key as string] = value;
            }
        }
        this.savedVariables.bindTable(this.values);
    }

    get<K extends keyof T>(key: K): T[K] {
        return this.values[key];
    }

    /** What the setting is for a player who never changed it. */
    getDefault<K extends keyof T>(key: K): T[K] {
        return this.createDefaults()[key];
    }

    /**
     * Changes a player choice and announces it. Nested tables are replaced as a whole: pass a new table.
     */
    change<K extends keyof T>(key: K, value: T[K]): void {
        this.values[key] = value;
        this.bus.emit("setting.changed", key as string);
    }

    /** Writes diagnostic data; nothing is announced. */
    write<K extends keyof T>(key: K, value: T[K]): void {
        this.values[key] = value;
    }
}
