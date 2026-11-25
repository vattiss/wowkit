// Profiles at random (issue #76): a character logs in with saved data in any state the builds could have left (new, saved
// before profiles, on its own profile, on one gone), on an account holding other profiles and characters, names that clash
// among them. Each case checks that nothing a character had is lost, that its own settings and its profile's stay apart,
// that a reload keeps them and that nothing else changes; then a copy or a reset, and a reload. Each case is played from its
// seed: a failure names it, to be played again.
import { createRandom, createWorld, describe, expect, it, playAs, PRIEST, reloadWorld, type Random, type World } from "@wowkit/test-kit";
import { openProfilesWindow } from "./profiles.helpers";

type Table = Record<string, unknown>;
type Kind = "new" | "beforeProfiles" | "own" | "gone";

/** The test kit's player GUID, and the name its own profile gets. */
const GUID = "Player-1-00000001";
const OWN_NAME = "Me - Forever (Human Priest)";
/** A few settings of each kind, with their defaults: a profile's, a character's own, and its own the account keeps. */
const PROFILE_KEYS = ["messageSize", "messageTop", "isOneLinePerType"];
const CHARACTER_KEYS = ["isTableAdvanced", "shownUnlearned"];
const ACCOUNT_KEYS = ["addedSpells", "fedItems"];
const DEFAULTS: Table = {
    messageSize: 100,
    messageTop: 180,
    isOneLinePerType: false,
    isTableAdvanced: false,
    shownUnlearned: {},
    addedSpells: [],
    fedItems: {},
};
/** The profiles an account may hold already: this character's own names among them. */
const OTHER_PROFILES = [OWN_NAME, "Me - Forever (Human Priest 2)", "Alt - Forever (Gnome Mage)", "Old"];
const KINDS: Kind[] = ["new", "beforeProfiles", "own", "gone"];
const CASES = 150;
/** Where the cases' seeds are drawn from: one after another, the generator's seeds would give cases alike. */
const SEEDS_SEED = 20261124;

/** One case: what is saved before the login, and the settings the character should have after it. */
interface Case {
    kind: Kind;
    saved: Table | undefined;
    account: { profiles: Record<string, Table>; characters: Record<string, Table> };
    expected: Table;
}

function pickProfileValues(random: Random): Table {
    const values: Table = {};
    if (random.isChance(0.6)) values.messageSize = 50 + random.pickIndex(150);
    if (random.isChance(0.6)) values.messageTop = 100 + random.pickIndex(200);
    if (random.isChance(0.6)) values.isOneLinePerType = random.isChance(0.5);
    return values;
}

function pickOwnValues(random: Random): Table {
    const values: Table = {};
    if (random.isChance(0.6)) values.isTableAdvanced = random.isChance(0.5);
    if (random.isChance(0.6)) values.shownUnlearned = { [`${100 + random.pickIndex(900)}`]: true };
    return values;
}

function pickAccountValues(random: Random): Table {
    const values: Table = {};
    const spellId = 100 + random.pickIndex(900);
    if (random.isChance(0.6)) values.addedSpells = [{ id: spellId, reminderType: "readyCooldown" }];
    if (random.isChance(0.6)) values.fedItems = { [`${spellId}`]: 1000 + random.pickIndex(9000) };
    return values;
}

/** The account as an earlier login left it: other profiles, and other characters' entries, this one's maybe too. */
function pickAccount(random: Random): Case["account"] {
    const profiles: Record<string, Table> = {};
    for (const name of OTHER_PROFILES) if (random.isChance(0.4)) profiles[name] = pickProfileValues(random);
    const characters: Record<string, Table> = {};
    const about = { name: "Alt", surname: "", realm: "Forever", race: "Gnome", className: "Mage", ruleset: "" };
    if (random.isChance(0.5)) characters["Player-1-00000002"] = { about, ...pickAccountValues(random) };
    // An entry of an earlier build, without who it is
    if (random.isChance(0.3)) characters["Player-1-00000003"] = pickAccountValues(random);
    // This character's, from an earlier login: what the account has stays
    if (random.isChance(0.3)) characters[GUID] = pickAccountValues(random);
    return { profiles, characters };
}

/** What the character saved, by the kind of case; its own profile goes into the account. */
function buildSaved(kind: Kind, account: Case["account"], values: { profile: Table; own: Table; old: Table }): Table | undefined {
    if (kind === "beforeProfiles") return { ...values.profile, ...values.own, ...values.old };
    if (kind === "gone") return { profileName: "Gone", ...values.own };
    if (kind !== "own") return undefined;
    account.profiles.Mine = values.profile;
    return { profileName: "Mine", ...values.own };
}

function makeCase(random: Random): Case {
    const kind = random.pickOne(KINDS);
    const account = pickAccount(random);
    const values = { profile: pickProfileValues(random), own: pickOwnValues(random), old: pickAccountValues(random) };
    const saved = buildSaved(kind, account, values);
    return { kind, saved, account, expected: buildExpected(kind, account, values) };
}

function pickKeys(values: Table, keys: string[]): Table {
    const picked: Table = {};
    for (const key of keys) picked[key] = values[key];
    return picked;
}

/** The settings the character should have after its login: what it had, else the defaults. */
function buildExpected(kind: Kind, account: Case["account"], values: { profile: Table; own: Table; old: Table }): Table {
    const profile = kind === "beforeProfiles" || kind === "own" ? values.profile : {};
    const own = kind !== "new" ? values.own : {};
    const old = kind === "beforeProfiles" ? values.old : {};
    const accountOwn = account.characters[GUID] ?? {};
    return { ...DEFAULTS, ...pickKeys(profile, PROFILE_KEYS), ...pickKeys(own, CHARACTER_KEYS), ...old, ...accountOwn };
}

/** A copy of a saved value, its tables too: what the case started with, as the addon changes the tables it is given. */
function copyDeep<T>(value: T): T {
    if (type(value) !== "table") return value;
    const copy: Table = {};
    for (const [key, inner] of pairs(value as object)) copy[key as string] = copyDeep(inner);
    return copy as T;
}

function isSame(a: unknown, b: unknown): boolean {
    if (type(a) !== "table" || type(b) !== "table") return a === b;
    for (const [key, inner] of pairs(a as object)) if (!isSame(inner, (b as Table)[key as string])) return false;
    for (const [key] of pairs(b as object)) if ((a as Table)[key as string] === undefined) return false;
    return true;
}

function check(isTrue: boolean, what: string): void {
    if (!isTrue) throw what;
}

function readAccount(world: World): { profiles: Record<string, Table>; characters: Record<string, Table> } {
    return world.getAccountSaved() as { profiles: Record<string, Table>; characters: Record<string, Table> };
}

const readCharacter = () => (_G as unknown as Record<string, Table>).GlowingBarsCharDB!;

/** The character's settings are those expected; its own and its profile's apart; nothing else changed. */
function checkSettings(world: World, expected: Table, started: Case["account"], changed: string, step: string): void {
    const account = readAccount(world);
    const character = readCharacter();
    const profileName = character.profileName as string;
    const profile = account.profiles[profileName];
    check(profile !== undefined, `${step}: the profile "${profileName}" is missing`);
    const settings = world.getSavedSettings()!;
    for (const [key, value] of pairs(expected)) {
        check(isSame(settings[key as string], value), `${step}: ${key as string} is ${tostring(settings[key as string])}`);
    }
    for (const key of [...CHARACTER_KEYS, ...ACCOUNT_KEYS, "profileName", "about"]) {
        check(profile![key] === undefined, `${step}: the profile holds ${key}`);
    }
    for (const key of [...PROFILE_KEYS, ...ACCOUNT_KEYS]) check(character[key] === undefined, `${step}: the character holds ${key}`);
    for (const [name, values] of pairs(started.profiles)) {
        if (name !== changed) check(isSame(account.profiles[name], values), `${step}: the profile "${name}" changed`);
    }
    for (const [key, values] of pairs(started.characters)) {
        if (key !== GUID) check(isSame(account.characters[key], values), `${step}: the character ${key} changed`);
    }
}

/** A copy from another profile, or a reset, in the Profiles window: what the character should have after the reload. */
/** Another character's profile deleted in the Profiles window, if there is one: its name. */
function deleteOther(world: World, random: Random): string | undefined {
    const ownName = readCharacter().profileName as string;
    const others = Object.keys(readAccount(world).profiles).filter((name) => name !== ownName);
    if (others.length === 0) return undefined;
    const name = random.pickOne(others);
    openProfilesWindow(world);
    world.setOption("deleteProfile", name);
    const box = world.frames.find((frame) => frame.name === "GlowingBarsProfilesQuestion")!;
    const button = world.frames.find((frame) => frame.parent === box && frame.text === "Delete")!;
    button.scripts.OnClick!(button);
    return name;
}

function copyOrReset(world: World, random: Random, expected: Table): Table {
    const ownName = readCharacter().profileName as string;
    const others = Object.keys(readAccount(world).profiles).filter((name) => name !== ownName);
    openProfilesWindow(world);
    const after: Table = { ...expected };
    const isCopy = others.length > 0 && random.isChance(0.7);
    const sourceName = isCopy ? random.pickOne(others) : undefined;
    const source = sourceName !== undefined ? readAccount(world).profiles[sourceName]! : {};
    for (const key of PROFILE_KEYS) after[key] = source[key] ?? DEFAULTS[key];
    if (sourceName !== undefined) world.setOption("copyProfile", sourceName);
    else world.clickOption("Reset profile");
    const box = world.frames.find((frame) => frame.name === "GlowingBarsProfilesQuestion")!;
    const button = world.frames.find((frame) => frame.parent === box && frame.text === (isCopy ? "Copy" : "Reset"))!;
    button.scripts.OnClick!(button);
    return after;
}

/**
 * An older build in between: the logout leaves the settings where it reads them, it changes one there, and this build
 * logs in again. What the character should have then.
 */
function goBackAndForth(world: World, random: Random, expected: Table): { world: World; expected: Table } {
    world.fire("PLAYER_LOGOUT");
    const saved = copyDeep(readCharacter());
    const account = readAccount(world);
    const key = random.pickOne(PROFILE_KEYS);
    const value = key === "isOneLinePerType" ? random.isChance(0.5) : 50 + random.pickIndex(150);
    saved[key] = value;
    const again = createWorld((state) => {
        playAs(state, PRIEST);
        state.accountSaved = account;
    }, saved);
    again.advance(1);
    return { world: again, expected: { ...expected, [key]: value } };
}

function playCase(seed: number): string | undefined {
    const random = createRandom(seed);
    const testCase = makeCase(random);
    const started = copyDeep(testCase.account);
    const [isDone, failure] = pcall(() => {
        let world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.accountSaved = testCase.account;
            },
            testCase.saved,
            { isNewCharacter: testCase.kind === "new" },
        );
        world.advance(1);
        const changed = testCase.kind === "own" ? "Mine" : "";
        checkSettings(world, testCase.expected, started, changed, "login");
        const profileName = readCharacter().profileName;
        check(testCase.kind === "own" || profileName !== "Mine", "login: took another's profile");
        world = reloadWorld(world);
        check(readCharacter().profileName === profileName, "reload: another profile");
        checkSettings(world, testCase.expected, started, changed, "reload");
        const older = goBackAndForth(world, random, testCase.expected);
        world = older.world;
        checkSettings(world, older.expected, started, profileName as string, "older build");
        const after = copyOrReset(world, random, older.expected);
        const beforeCopy = copyDeep(readAccount(world));
        world = reloadWorld(world);
        checkSettings(world, after, beforeCopy, profileName as string, "copy or reset");
        const beforeDelete = copyDeep(readAccount(world));
        const deleted = deleteOther(world, random);
        if (deleted !== undefined) beforeDelete.profiles[deleted] = undefined as never;
        check(deleted === undefined || readAccount(world).profiles[deleted] === undefined, `delete: "${deleted}" is still there`);
        checkSettings(world, after, beforeDelete, profileName as string, "delete");
    });
    if (isDone) return undefined;
    return `seed ${seed} (${testCase.kind}): ${tostring(failure)}`;
}

describe("profiles at random", () => {
    it("lose nothing a character had, keep its own apart, and change nothing else", () => {
        const failures: string[] = [];
        const seeds = createRandom(SEEDS_SEED);
        for (let n = 1; n <= CASES; n++) {
            const failure = playCase(1 + seeds.pickIndex(2147483646));
            if (failure !== undefined) failures.push(failure);
        }
        const first = failures.length > 0 ? `; first: ${failures[0]}` : "";
        expect(`${failures.length} of ${CASES} cases failed${first}`).toBe(`0 of ${CASES} cases failed`);
    });
});
