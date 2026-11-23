// Settings kept in profiles, shared by the characters of an account: the account's saved data (## SavedVariables) holds the
// profiles by name, each character's (## SavedVariablesPerCharacter) the name of the one it uses and what is its own alone
// (what it learned as it played). Some of a character's own are kept in the account's data instead, under its name, so
// every character of the account can see them (the spells it added). A character saved before profiles were known gets a
// profile of its own, made of what it had, so nothing changes for it; a new character starts on the default profile.
//
// The rest of the addon sees one set of settings (SettingsStore): get and change go to the profile or to the character by
// the key.
import type { EventBus, OnAddonLoaded } from "@wowkit/core";
import type { SavedVariablesService } from "@wowkit/wow";
import type { SettingsStore } from "./settings.service";

/** The profile a new character starts on. */
export const DEFAULT_PROFILE = "Default";

/** What the account keeps of the profiles and the characters, beside whatever else the addon keeps there. */
interface AccountTable {
    profiles?: { [name: string]: Record<string, unknown> | undefined };
    /** Each character's settings that every character may see, by "Name - Realm". */
    characters?: { [name: string]: Record<string, unknown> | undefined };
}

/** What a character keeps: the name of its profile, and the settings of its own. */
interface CharacterTable {
    profileName?: string;
}

export interface ProfiledSettingsOptions<T extends object> {
    /** The keys that are each character's own, kept in its saved data. */
    characterKeys: readonly (keyof T)[];
    /** The keys that are each character's own, kept in the account's data under its name, for every character to see. */
    accountCharacterKeys?: readonly (keyof T)[];
    /** Puts right what a saved value got wrong, once the values are loaded (on the settings as one set). */
    repair?: (values: T) => void;
    /** The player's "Name - Realm": a character's own profile is named so, and its settings in the account's data. */
    findCharacterName?: () => string;
}

export class ProfiledSettingsService<T extends object> implements OnAddonLoaded, SettingsStore<T> {
    /** The character's saved table: its own settings. Bound to the saved data once loaded. */
    private character: Record<string, unknown> = {};
    /** The profile the character uses: a table of the account's saved data. */
    private profile: Record<string, unknown> = {};
    /** The account's data, and this character's own settings in it. */
    private account: AccountTable = {};
    private accountCharacter: Record<string, unknown> = {};
    private characterName = "";
    private readonly characterKeys = new LuaSet<string>();
    private readonly accountCharacterKeys = new LuaSet<string>();
    private readonly repair: ((values: T) => void) | undefined;
    private readonly findCharacterName: () => string;

    constructor(
        private readonly characterVariables: SavedVariablesService,
        private readonly accountVariables: SavedVariablesService,
        private readonly bus: EventBus,
        /** Makes the settings of a player who has none saved yet. */
        private readonly createDefaults: () => T,
        options: ProfiledSettingsOptions<T>,
    ) {
        for (const key of options.characterKeys) this.characterKeys.add(key as string);
        for (const key of options.accountCharacterKeys ?? []) this.accountCharacterKeys.add(key as string);
        this.repair = options.repair;
        this.findCharacterName = options.findCharacterName ?? findPlayerName;
    }

    onAddonLoaded(): void {
        // Loaded and bound first, so whoever else keeps something in the account's data shares this very table
        const account = this.accountVariables.loadTable<AccountTable>() ?? {};
        this.accountVariables.bindTable(account);
        account.profiles ??= {};
        account.characters ??= {};
        const saved = this.characterVariables.loadTable<CharacterTable & Record<string, unknown>>();
        const character: CharacterTable & Record<string, unknown> = saved ?? {};
        // No profile yet (saved before profiles), or its profile is gone: what it holds of a profile's becomes one of its own
        if (character.profileName === undefined || account.profiles[character.profileName] === undefined) {
            character.profileName = this.hasProfileSettings(character)
                ? this.createOwnProfile(character, account, character.profileName)
                : DEFAULT_PROFILE;
        }
        this.account = account;
        this.characterName = this.findCharacterName();
        this.accountCharacter = account.characters[this.characterName] ??= {};
        this.saveInAccount(character);
        this.character = character;
        this.profile = account.profiles[character.profileName] ??= {};
        this.fillAndRepair();
        this.characterVariables.bindTable(character);
    }

    get<K extends keyof T>(key: K): T[K] {
        return this.findTable(key)[key as string] as T[K];
    }

    getDefault<K extends keyof T>(key: K): T[K] {
        return this.createDefaults()[key];
    }

    change<K extends keyof T>(key: K, value: T[K]): void {
        this.findTable(key)[key as string] = value;
        this.bus.emit("setting.changed", key as string);
    }

    /** The name of the profile this character uses. */
    getProfileName(): string {
        return (this.character as CharacterTable).profileName ?? DEFAULT_PROFILE;
    }

    /** This character's "Name - Realm". */
    getCharacterName(): string {
        return this.characterName;
    }

    /** The characters of the account whose settings the account keeps ("Name - Realm"), this one among them. */
    listCharacterNames(): string[] {
        const names: string[] = [];
        for (const [name] of pairs(this.account.characters ?? {})) names.push(name as string);
        table.sort(names);
        return names;
    }

    /** A setting another character keeps in the account's data (an accountCharacterKey); undefined for one not known. */
    getOfCharacter<K extends keyof T>(name: string, key: K): T[K] | undefined {
        return this.account.characters?.[name]?.[key as string] as T[K] | undefined;
    }

    /** Changes a setting of any character kept in the account's data; this character's is announced as a change. */
    changeOfCharacter<K extends keyof T>(name: string, key: K, value: T[K]): void {
        const entry = this.account.characters?.[name];
        if (entry === undefined) return;
        entry[key as string] = value;
        if (name === this.characterName) this.bus.emit("setting.changed", key as string);
    }

    private findTable(key: keyof T): Record<string, unknown> {
        if (this.accountCharacterKeys.has(key as string)) return this.accountCharacter;
        return this.characterKeys.has(key as string) ? this.character : this.profile;
    }

    /** Is the key a character's own, wherever it is kept? */
    private isOwnKey(key: string): boolean {
        return this.characterKeys.has(key) || this.accountCharacterKeys.has(key) || key === "profileName";
    }

    /** Does the character's table hold settings of a profile's (saved before profiles, or a profile gone)? */
    private hasProfileSettings(character: Record<string, unknown>): boolean {
        for (const [key] of pairs(character)) if (!this.isOwnKey(key as string)) return true;
        return false;
    }

    /**
     * A character saved before profiles, or whose profile is gone: what is not its own moves into a profile of its own, under
     * the name it had, else its own ("Name - Realm").
     */
    private createOwnProfile(character: Record<string, unknown>, account: AccountTable, wantedName: string | undefined): string {
        const profiles = account.profiles!;
        const base = wantedName ?? this.findCharacterName();
        let name = base;
        for (let n = 2; profiles[name] !== undefined; n++) name = `${base} (${n})`;
        const profile: Record<string, unknown> = {};
        for (const [key, value] of pairs(character)) {
            if (this.isOwnKey(key as string)) continue;
            profile[key as string] = value;
            character[key as string] = undefined;
        }
        profiles[name] = profile;
        return name;
    }

    /** What a character saved of its own that the account keeps now moves there (once: what the account has stays). */
    private saveInAccount(character: Record<string, unknown>): void {
        for (const key of this.accountCharacterKeys) {
            if (character[key] === undefined) continue;
            this.accountCharacter[key] ??= character[key];
            character[key] = undefined;
        }
    }

    /**
     * Every setting not saved yet takes its default; then the repair runs on the settings as one set (old keys too, which it
     * may move or drop), and each goes back into its table.
     */
    private fillAndRepair(): void {
        const values = this.createDefaults() as Record<string, unknown>;
        const keys = new LuaSet<string>();
        for (const [key] of pairs(values)) keys.add(key as string);
        for (const source of [this.profile, this.character, this.accountCharacter]) {
            for (const [key, value] of pairs(source)) {
                if (key === "profileName") continue;
                values[key as string] = value;
                keys.add(key as string);
            }
        }
        this.repair?.(values as T);
        for (const [key] of pairs(values)) keys.add(key as string);
        for (const key of keys) this.findTable(key as keyof T)[key] = values[key];
    }
}

/** "Name - Realm" of the player. */
function findPlayerName(): string {
    const [name] = UnitName("player");
    return `${name ?? "?"} - ${GetRealmName() ?? "?"}`;
}
