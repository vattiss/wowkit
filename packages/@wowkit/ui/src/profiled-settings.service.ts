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
import { describeCharacter, findPlayer, listOldKeys, pickProfileName, type CharacterInfo } from "./character-identity";

/** The profile a new character starts on. */
export const DEFAULT_PROFILE = "Default";
/** Where a character's entry in the account's data says who it is (name, realm, race, class). */
const ABOUT_KEY = "about";

/** What the account keeps of the profiles and the characters, beside whatever else the addon keeps there. */
interface AccountTable {
    profiles?: { [name: string]: Record<string, unknown> | undefined };
    /** Each character's settings that every character may see, by "Name - Realm". */
    characters?: { [name: string]: Record<string, unknown> | undefined };
    /** A profile renamed: its old name -> its new one, so a character not logged in since finds it. */
    renamedProfiles?: { [oldName: string]: string | undefined };
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
    /** Who the player is: its settings in the account's data are kept by its GUID, its own profile named after it. */
    findCharacter?: () => CharacterInfo;
}

export class ProfiledSettingsService<T extends object> implements OnAddonLoaded, SettingsStore<T> {
    /** The character's saved table: its own settings. Bound to the saved data once loaded. */
    private character: Record<string, unknown> = {};
    /** The profile the character uses: a table of the account's saved data. */
    private profile: Record<string, unknown> = {};
    /** The account's data, and this character's own settings in it. */
    private account: AccountTable = {};
    private accountCharacter: Record<string, unknown> = {};
    private player: CharacterInfo = { key: "", name: "", surname: "", realm: "", race: "", className: "", ruleset: "" };
    private readonly characterKeys = new LuaSet<string>();
    private readonly accountCharacterKeys = new LuaSet<string>();
    private readonly repair: ((values: T) => void) | undefined;
    private readonly findCharacter: () => CharacterInfo;

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
        this.findCharacter = options.findCharacter ?? findPlayer;
    }

    onAddonLoaded(): void {
        // Loaded and bound first, so whoever else keeps something in the account's data shares this very table
        const account = this.accountVariables.loadTable<AccountTable>() ?? {};
        this.accountVariables.bindTable(account);
        account.profiles ??= {};
        account.characters ??= {};
        const saved = this.characterVariables.loadTable<CharacterTable & Record<string, unknown>>();
        const character: CharacterTable & Record<string, unknown> = saved ?? {};
        this.player = this.findCharacter();
        this.takeOldEntries(account, character);
        character.profileName = findRenamed(account, character.profileName);
        // No profile yet (saved before profiles), or its profile is gone: what it holds of a profile's becomes one of its own
        if (character.profileName === undefined || account.profiles[character.profileName] === undefined) {
            character.profileName = this.hasProfileSettings(character)
                ? this.createOwnProfile(character, account, character.profileName)
                : DEFAULT_PROFILE;
        }
        this.account = account;
        this.accountCharacter = account.characters[this.player.key] ??= {};
        // Who it is, for the list of every character's added spells
        const { name, surname, realm, race, className, ruleset } = this.player;
        this.accountCharacter[ABOUT_KEY] = { name, surname, realm, race, className, ruleset };
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

    /** Every profile of the account, by name. */
    listProfileNames(): string[] {
        const names: string[] = [];
        for (const [name] of pairs(this.account.profiles ?? {})) names.push(name as string);
        table.sort(names);
        return names;
    }

    /** Makes an empty profile (the defaults) of this name; false when the name is taken or empty. */
    createProfile(name: string): boolean {
        const profiles = this.account.profiles!;
        if (!isProfileName(name) || profiles[name] !== undefined) return false;
        profiles[name] = {};
        return true;
    }

    /** This character uses that profile from the next load of the interface on (its settings are read as it loads). */
    useProfile(name: string): boolean {
        if (this.account.profiles?.[name] === undefined) return false;
        (this.character as CharacterTable).profileName = name;
        return true;
    }

    /** The settings of that profile replace this one's, from the next load of the interface on. */
    copyProfile(from: string): boolean {
        const source = this.account.profiles?.[from];
        if (source === undefined || from === this.getProfileName()) return false;
        for (const [key] of pairs(this.profile)) this.profile[key as string] = undefined;
        for (const [key, value] of pairs(source)) this.profile[key as string] = copyValue(value);
        this.fillProfileDefaults();
        return true;
    }

    /** Renames this character's profile; the characters on it that log in later follow the new name. */
    changeProfileName(newName: string): boolean {
        const profiles = this.account.profiles!;
        const oldName = this.getProfileName();
        if (!isProfileName(newName) || profiles[newName] !== undefined) return false;
        profiles[newName] = profiles[oldName];
        profiles[oldName] = undefined;
        (this.character as CharacterTable).profileName = newName;
        const renamed = (this.account.renamedProfiles ??= {});
        // A name used again later is a profile of its own, not the renamed one
        renamed[newName] = undefined;
        renamed[oldName] = newName;
        return true;
    }

    /** Deletes a profile other than this character's; a character on it gets the Default profile when it logs in. */
    deleteProfile(name: string): boolean {
        const profiles = this.account.profiles!;
        if (name === this.getProfileName() || profiles[name] === undefined) return false;
        profiles[name] = undefined;
        return true;
    }

    /** This character's profile back to the defaults, from the next load of the interface on. */
    resetProfile(): void {
        for (const [key] of pairs(this.profile)) this.profile[key as string] = undefined;
        this.fillProfileDefaults();
    }

    /** A profile's settings it lacks take their defaults at once: until the reload the addon goes on reading them. */
    private fillProfileDefaults(): void {
        for (const [key, value] of pairs(this.createDefaults() as Record<string, unknown>)) {
            if (!this.isOwnKey(key as string) && this.profile[key as string] === undefined) this.profile[key as string] = value;
        }
    }

    /** The name of the profile this character uses. */
    getProfileName(): string {
        return (this.character as CharacterTable).profileName ?? DEFAULT_PROFILE;
    }

    /** This character's key (its GUID), as listCharacters gives it. */
    getCharacterKey(): string {
        return this.player.key;
    }

    /**
     * The characters of the account whose settings the account keeps, this one among them, by name: "Castor (Gnome Priest)".
     */
    listCharacters(): { key: string; label: string }[] {
        const known: { key: string; about: CharacterInfo }[] = [];
        for (const [key, entry] of pairs(this.account.characters ?? {})) {
            const about = (entry as Record<string, unknown>)[ABOUT_KEY] as CharacterInfo | undefined;
            if (about !== undefined) known.push({ key: key as string, about });
        }
        const listed = known.map(({ key, about }) => ({ key, label: describeCharacter(about) }));
        table.sort(listed, (a, b) => a.label < b.label);
        return listed;
    }

    /** A setting a character keeps in the account's data (an accountCharacterKey), by its key; undefined for one not known. */
    getOfCharacter<K extends keyof T>(characterKey: string, key: K): T[K] | undefined {
        return this.account.characters?.[characterKey]?.[key as string] as T[K] | undefined;
    }

    /** Changes a setting of any character kept in the account's data; this character's is announced as a change. */
    changeOfCharacter<K extends keyof T>(characterKey: string, key: K, value: T[K]): void {
        const entry = this.account.characters?.[characterKey];
        if (entry === undefined) return;
        entry[key as string] = value;
        if (characterKey === this.player.key) this.bus.emit("setting.changed", key as string);
    }

    private findTable(key: keyof T): Record<string, unknown> {
        if (this.accountCharacterKeys.has(key as string)) return this.accountCharacter;
        return this.characterKeys.has(key as string) ? this.character : this.profile;
    }

    /**
     * An earlier build kept a character's settings in the account's data by its name ("Castor - Realm", "Castor - " where the
     * client named no realm, "Castor"): the first character of that name to log in takes them to its GUID. Its own profile
     * named "Castor - " is "Castor" now, where that is free.
     */
    private takeOldEntries(account: AccountTable, character: CharacterTable): void {
        const characters = account.characters!;
        for (const oldKey of listOldKeys(this.player)) {
            if (characters[oldKey] === undefined) continue;
            characters[this.player.key] ??= characters[oldKey];
            characters[oldKey] = undefined;
        }
        const profiles = account.profiles!;
        const oldName = `${this.player.name} - `;
        const name = describeCharacter(this.player);
        if (character.profileName === oldName && profiles[oldName] !== undefined && profiles[name] === undefined) {
            profiles[name] = profiles[oldName];
            profiles[oldName] = undefined;
            character.profileName = name;
        }
    }

    /** Is the key a character's own, wherever it is kept? Who the character is (in the account's data) is no setting. */
    private isOwnKey(key: string): boolean {
        return this.characterKeys.has(key) || this.accountCharacterKeys.has(key) || key === "profileName" || key === ABOUT_KEY;
    }

    /** Does the character's table hold settings of a profile's (saved before profiles, or a profile gone)? */
    private hasProfileSettings(character: Record<string, unknown>): boolean {
        for (const [key] of pairs(character)) if (!this.isOwnKey(key as string)) return true;
        return false;
    }

    /**
     * A character saved before profiles, or whose profile is gone: what is not its own moves into a profile of its own, under
     * the name it had, else its own: "Castor", "Castor (Gnome Priest)" where that is taken, and only then numbered.
     */
    private createOwnProfile(character: Record<string, unknown>, account: AccountTable, wantedName: string | undefined): string {
        const profiles = account.profiles!;
        const name = pickProfileName((taken) => profiles[taken] !== undefined, this.player, wantedName);
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
                if (key === "profileName" || key === ABOUT_KEY) continue;
                values[key as string] = value;
                keys.add(key as string);
            }
        }
        this.repair?.(values as T);
        for (const [key] of pairs(values)) keys.add(key as string);
        for (const key of keys) this.findTable(key as keyof T)[key] = values[key];
    }
}

/** The longest a profile's name may be. */
const MOST_NAME_LETTERS = 40;

/** Can this be a profile's name: some letters, not too many? */
function isProfileName(name: string): boolean {
    const trimmed = string.match(name, "^%s*(.-)%s*$")[0] ?? "";
    return trimmed === name && name !== "" && name.length <= MOST_NAME_LETTERS;
}

/** A profile's name, following its renames (at most a few, against a loop). */
function findRenamed(account: AccountTable, name: string | undefined): string | undefined {
    let current = name;
    for (let step = 0; step < 10 && current !== undefined && account.profiles?.[current] === undefined; step++) {
        const next = account.renamedProfiles?.[current];
        if (next === undefined) break;
        current = next;
    }
    return current;
}

/** A copy of a saved value, its tables too: a profile copied is changed apart from the one it came from. */
function copyValue(value: unknown): unknown {
    if (type(value) !== "table") return value;
    const copy: Record<string, unknown> = {};
    for (const [key, inner] of pairs(value as object)) copy[key as string] = copyValue(inner);
    return copy;
}
