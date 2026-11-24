// Settings kept in profiles, one for each character of an account: the account's saved data (## SavedVariables) holds the
// profiles by name, so a character can copy another's; each character's (## SavedVariablesPerCharacter) the name of its
// own and what is its own alone besides (what it learned as it played). Some of a character's own are kept in the account's
// data instead, under its GUID, so every character of the account can see them (the spells it added). A character saved
// before profiles gets its profile made of what it had, so nothing changes for it; a new one starts with the defaults.
//
// The rest of the addon sees one set of settings (SettingsStore): get and change go to the profile or to the character by
// the key.
import type { EventBus, OnAddonLoaded } from "@wowkit/core";
import type { SavedVariablesService } from "@wowkit/wow";
import type { SettingsStore } from "./settings.service";
import { describeCharacter, findPlayer, pickProfileName, type CharacterInfo } from "./character-identity";

/** Where a character's entry in the account's data says who it is (name, realm, race, class). */
const ABOUT_KEY = "about";

/** What the account keeps of the profiles and the characters, beside whatever else the addon keeps there. */
interface AccountTable {
    profiles?: { [name: string]: Record<string, unknown> | undefined };
    /** Each character's settings that every character may see, by its GUID. */
    characters?: { [key: string]: Record<string, unknown> | undefined };
}

/** What a character keeps: the name of its own profile, and the settings of its own besides. */
interface CharacterTable {
    profileName?: string;
}

export interface ProfiledSettingsOptions<T extends object> {
    /** The keys that are each character's own, kept in its saved data. */
    characterKeys: readonly (keyof T)[];
    /** The keys that are each character's own, kept in the account's data under its GUID, for every character to see. */
    accountCharacterKeys?: readonly (keyof T)[];
    /** Puts right what a saved value got wrong, once the values are loaded (on the settings as one set). */
    repair?: (values: T) => void;
    /** Who the player is: its settings in the account's data are kept by its GUID, its own profile named after it. */
    findCharacter?: () => CharacterInfo;
}

/** What is not known of a character: empty. */
const UNKNOWN_CHARACTER: CharacterInfo = { key: "", name: "", surname: "", realm: "", race: "", className: "", ruleset: "" };

export class ProfiledSettingsService<T extends object> implements OnAddonLoaded, SettingsStore<T> {
    /** The character's saved table: its own settings. Bound to the saved data once loaded. */
    private character: Record<string, unknown> = {};
    /** The profile the character uses: a table of the account's saved data. */
    private profile: Record<string, unknown> = {};
    /** The account's data, and this character's own settings in it. */
    private account: AccountTable = {};
    private accountCharacter: Record<string, unknown> = {};
    private player: CharacterInfo = UNKNOWN_CHARACTER;
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
        const oldName = character.profileName;
        // No profile yet (new, or saved before profiles), or its own gone: one of its own
        const isOwn = oldName !== undefined && account.profiles[oldName] !== undefined;
        const profileName = isOwn ? oldName : this.createOwnProfile(character, account);
        character.profileName = profileName;
        this.account = account;
        this.accountCharacter = account.characters[this.player.key] ??= {};
        // Who it is, for the list of every character's added spells
        const { name, surname, realm, race, className, ruleset } = this.player;
        this.accountCharacter[ABOUT_KEY] = { name, surname, realm, race, className, ruleset };
        this.saveInAccount(character);
        this.character = character;
        this.profile = account.profiles[profileName] ??= {};
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

    /** The settings of that profile replace this one's, from the next load of the interface on. */
    copyProfile(from: string): boolean {
        const source = this.account.profiles?.[from];
        if (source === undefined || from === this.getProfileName()) return false;
        for (const [key] of pairs(this.profile)) this.profile[key as string] = undefined;
        for (const [key, value] of pairs(source)) this.profile[key as string] = copyValue(value);
        this.fillProfileDefaults();
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
        return (this.character as CharacterTable).profileName ?? "";
    }

    /** This character's key (its GUID), as listCharacters gives it. */
    getCharacterKey(): string {
        return this.player.key;
    }

    /**
     * The characters of the account whose settings the account keeps, this one among them, by name: "Castor Stormlight (Gnome Priest, Normal)".
     */
    listCharacters(): { key: string; label: string }[] {
        const known: { key: string; about: CharacterInfo }[] = [];
        for (const [key, entry] of pairs(this.account.characters ?? {})) {
            const about = (entry as Record<string, unknown>)[ABOUT_KEY] as CharacterInfo | undefined;
            if (about !== undefined) known.push({ key: key as string, about });
        }
        // An entry an earlier build wrote may lack what came later (the surname, the ruleset)
        const listed = known.map(({ key, about }) => ({ key, label: describeCharacter({ ...UNKNOWN_CHARACTER, ...about }) }));
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

    /** Is the key a character's own, wherever it is kept? Who the character is (in the account's data) is no setting. */
    private isOwnKey(key: string): boolean {
        return this.characterKeys.has(key) || this.accountCharacterKeys.has(key) || key === "profileName" || key === ABOUT_KEY;
    }

    /**
     * The character's own profile, "Castor Stormlight (Gnome Priest, Normal)", numbered where taken: what it holds that is not its
     * own (saved before profiles) moved in.
     */
    private createOwnProfile(character: Record<string, unknown>, account: AccountTable): string {
        const profiles = account.profiles!;
        const name = pickProfileName((taken) => profiles[taken] !== undefined, this.player);
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

/** A copy of a saved value, its tables too: a profile copied is changed apart from the one it came from. */
function copyValue(value: unknown): unknown {
    if (type(value) !== "table") return value;
    const copy: Record<string, unknown> = {};
    for (const [key, inner] of pairs(value as object)) copy[key as string] = copyValue(inner);
    return copy;
}
