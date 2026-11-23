// Who a character is, for the settings an account keeps of each: its GUID, one of its own that never changes, even where
// characters of several realms share a name and the client names no realm (Forever); and how it is named to the player:
// "Castor" with its surname where it has one (Forever), always with "(Gnome Priest)" and the realm's ruleset where there is
// one ("(Gnome Priest, Normal)"), and only then a number.

export interface CharacterInfo {
    /** The GUID: what the character is kept by. */
    key: string;
    name: string;
    /** Its second name (Forever's surname); empty where it has none. */
    surname: string;
    /** Empty where the client names no realm. */
    realm: string;
    race: string;
    className: string;
    /** The realm's ruleset as the game words it (Normal, PvP, RP, Hardcore); empty where the client has none (not Forever). */
    ruleset: string;
}

/** The player, as the client says. */
export function findPlayer(): CharacterInfo {
    // Forever's client gives the surname as the second answer, where another client gives none for the player
    const [name, surname] = UnitName("player");
    const realm = GetRealmName() ?? "";
    const [race] = UnitRace("player");
    const [className] = UnitClass("player");
    const plainName = name ?? "?";
    return {
        key: UnitGUID("player") ?? `${plainName}-${realm}`,
        name: plainName,
        surname: surname ?? "",
        realm,
        race: race ?? "",
        className: className ?? "",
        ruleset: findRuleset(),
    };
}

/** "Castor", with its surname as the game writes it where it has one, and " - Realm" where the client names one. */
export function buildCharacterName(info: CharacterInfo): string {
    const fullName = info.surname !== "" ? `${info.name}${findSurnameSeparator()}${info.surname}` : info.name;
    return info.realm !== "" ? `${fullName} - ${info.realm}` : fullName;
}

/** What the game puts between a name and its surname; a space where it has none to say. */
function findSurnameSeparator(): string {
    const separators = (_G as unknown as { Constants?: { CharacterNameSeparatorConsts?: { CHARACTERNAME_SURNAME_SEPARATOR?: string } } })
        .Constants;
    return separators?.CharacterNameSeparatorConsts?.CHARACTERNAME_SURNAME_SEPARATOR ?? " ";
}

/** "Castor Stormlight (Gnome Priest, Normal)": a name with what tells it apart from another of the same name. */
export function describeCharacter(info: CharacterInfo): string {
    const kind = describeKind(info);
    return kind !== "" ? `${buildCharacterName(info)} (${kind})` : buildCharacterName(info);
}

/** "Gnome Priest, Normal": the race and class, and the realm's ruleset where there is one. */
function describeKind(info: CharacterInfo): string {
    const raceAndClass = `${info.race} ${info.className}`.trim();
    return [raceAndClass, info.ruleset].filter((part) => part !== "").join(", ");
}

/**
 * The realm's ruleset, from Forever's game rules, in the game's own words for it: Hardcore, RP PvP, PvP, RP, else Normal.
 * Empty on a client without them.
 */
function findRuleset(): string {
    const globals = _G as unknown as Record<string, unknown>;
    const rules = (globals.Enum as { GameRule?: Record<string, number | undefined> } | undefined)?.GameRule;
    const isRuleActive = (globals.C_GameRules as typeof C_GameRules | undefined)?.IsGameRuleActive;
    if (rules === undefined || isRuleActive === undefined) return "";
    const isOn = (name: string) => {
        const rule = rules[name];
        if (rule === undefined) return false;
        const [didSucceed, isActive] = pcall(isRuleActive, rule as never);
        return didSucceed && isActive === true;
    };
    const readWord = (name: string) => (globals[name] as string | undefined) ?? "";
    if (isOn("HardcoreRuleset")) return readWord("GUILD_PLAYSTYLE_HARDCORE");
    const isPvp = isOn("PvPRuleset");
    const isRp = isOn("RPRuleset");
    if (isPvp && isRp) return readWord("GDAPI_REALMTYPE_PVP_RP");
    if (isPvp) return readWord("GDAPI_REALMTYPE_PVP");
    return isRp ? readWord("GDAPI_REALMTYPE_RP") : readWord("GDAPI_REALMTYPE_NORMAL");
}

/** A name for a character's own profile no other profile has: its name with its race and class, numbered where taken. */
export function pickProfileName(isTaken: (name: string) => boolean, info: CharacterInfo, wantedName?: string): string {
    if (wantedName !== undefined && !isTaken(wantedName)) return wantedName;
    const described = describeCharacter(info);
    if (!isTaken(described)) return described;
    const plain = buildCharacterName(info);
    const kind = describeKind(info);
    for (let n = 2; ; n++) {
        const numbered = kind !== "" ? `${plain} (${kind} ${n})` : `${plain} (${n})`;
        if (!isTaken(numbered)) return numbered;
    }
}

/** The names an earlier build kept a character's settings by, before the GUID: "Castor - Realm", "Castor - ", "Castor". */
export function listOldKeys(info: CharacterInfo): string[] {
    return [`${info.name} - ${info.realm}`, `${info.name} - `, info.name];
}
