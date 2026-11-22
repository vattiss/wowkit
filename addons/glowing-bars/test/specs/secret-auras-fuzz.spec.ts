// Auras hidden at random, as a game changed tomorrow could hide them (issue #88): a player casts a buff, it runs out, they
// fight, die, cancel it, while the client hides its aura in every way it can and C_Secrets says right or wrong. The test
// knows the truth and checks every second that the addon never lights a buff that is up, never breaks, and shows the truth
// whenever nothing is hidden. Each case is played from its seed: a failure names it, to be played again.
import {
    BATTLE_SHOUT,
    createRandom,
    createWorld,
    describe,
    expect,
    FORTITUDE,
    it,
    learnSpell,
    playAs,
    PRIEST,
    reloadWorld,
    WARRIOR,
    type CharacterClass,
    type Random,
    type SecretsAnswer,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

/** A buff to play with, and how long it really lasts (what the addon knows of it, for a class buff). */
interface Profile {
    label: string;
    playerClass: CharacterClass;
    buff: SpellDefinition;
    seconds: number;
    isAdded: boolean;
}

const WARD: SpellDefinition = { id: 1297774, name: "Magical Awareness", rank: 1, icon: 1, isHelpful: true };
const DEVOTION_AURA: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };
const PALADIN: CharacterClass = { name: "Paladin", token: "PALADIN", id: 2 };
/**
 * An aura of another kind the player always has, never hidden: in a fight an empty list is taken for one the client hides,
 * and a player seldom has no aura at all.
 */
const OTHER_AURA = { name: "Other Aura", spellId: 99001, expirationTime: 1e9 };
const PROFILES: Profile[] = [
    { label: "a warrior's Battle Shout", playerClass: WARRIOR, buff: BATTLE_SHOUT, seconds: 180, isAdded: false },
    { label: "a priest's Fortitude", playerClass: PRIEST, buff: FORTITUDE, seconds: 3600, isAdded: false },
    { label: "a buff the player added", playerClass: PRIEST, buff: WARD, seconds: 120, isAdded: true },
    { label: "a paladin's aura", playerClass: PALADIN, buff: DEVOTION_AURA, seconds: 1800, isAdded: false },
];

/** Cases for each buff, and seconds played in each. */
const CASES = 40;
const SECONDS = 240;
/** In its last seconds a buff may glow already (a Before): not checked then. */
const LAST_SECONDS = 5;
const ANSWERS: SecretsAnswer[] = [true, false, "secret", "error"];

/** One case being played: the world, the truth of the buff, and what happened, to tell if it fails. */
interface Play {
    world: World;
    profile: Profile;
    random: Random;
    log: string[];
    second: number;
    deadFor: number;
    /** Seconds in a row the buff has been gone, with nothing hidden: the addon may take a tick to see it (a cast settling, a revive). */
    shownGone: number;
}

/** The buff's aura on the player, if the truth is that it is up. */
function findBuff(play: Play): { expirationTime: number } | undefined {
    return play.world.state.auras.find((aura) => aura.spellId === play.profile.buff.id);
}

function readRemain(play: Play): number {
    const aura = findBuff(play);
    return aura === undefined ? 0 : aura.expirationTime - GetTime();
}

function createPlay(profile: Profile, seed: number): Play {
    const random = createRandom(seed);
    const world = createWorld(
        (state) => {
            playAs(state, profile.playerClass);
            learnSpell(state, profile.buff);
            state.bars[1] = profile.buff.id;
            state.auraSecrecy.hiddenSpells[profile.buff.id] = true;
            if (random.isChance(0.1)) state.auraSecrecy.saysRestricted = "missing";
            state.auraSecrecy.isSpellCallMissing = random.isChance(0.1);
            if (random.isChance(0.4)) state.trackedBuffs.push({ spellId: profile.buff.id, isActive: false });
        },
        {
            addedSpells: profile.isAdded ? [{ id: profile.buff.id, reminderType: "missingBuff" }] : [],
            styles: { missingBuff: { when: "always" } },
        },
    );
    const play: Play = { world, profile, random, log: [], second: 0, deadFor: 0, shownGone: 0 };
    world.state.auras.push({ ...OTHER_AURA });
    if (random.isChance(0.5)) castBuff(play);
    world.advance(1);
    return play;
}

/** Writes down what happened, with the second it happened in. */
function note(play: Play, text: string): void {
    play.log.push(`${play.second}s ${text}`);
}

function castBuff(play: Play): void {
    const { world, profile } = play;
    world.state.auras = world.state.auras.filter((aura) => aura.spellId !== profile.buff.id);
    world.state.auras.push(world.makeAura(profile.buff.name, profile.buff.id, profile.seconds, "player"));
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", profile.buff.id);
    note(play, "cast");
}

/** What the player does this second: cast, cancel, die, come back. */
function playPlayer(play: Play): void {
    const { world, random } = play;
    if (play.deadFor > 0) {
        play.deadFor -= 1;
        if (play.deadFor === 0) {
            world.state.isPlayerDead = false;
            world.state.auras.push({ ...OTHER_AURA });
            world.fire("PLAYER_ALIVE");
            note(play, "alive");
        }
        return;
    }
    if (random.isChance(0.06)) castBuff(play);
    else if (random.isChance(0.02)) {
        world.state.auras = world.state.auras.filter((aura) => aura.spellId !== play.profile.buff.id);
        note(play, "cancel");
    } else if (random.isChance(0.01)) {
        world.state.auras = [];
        world.state.isPlayerDead = true;
        play.deadFor = 5 + random.pickIndex(10);
        world.fire("PLAYER_DEAD");
        note(play, "die");
    }
}

/** A moment the client may start or stop hiding at, this second: a fight starting or ending, a zone, or a /reload. */
function playMoment(play: Play): boolean {
    const { world, random } = play;
    if (random.isChance(0.05)) {
        const isInCombat = !world.state.isInCombat;
        world.state.isInCombat = isInCombat;
        world.state.areAurasHidden = isInCombat && random.isChance(0.5);
        world.fire(isInCombat ? "PLAYER_REGEN_DISABLED" : "PLAYER_REGEN_ENABLED");
        note(play, isInCombat ? `fight${world.state.areAurasHidden ? " (list empty)" : ""}` : "fight over");
        return true;
    }
    if (random.isChance(0.01)) {
        // A /reload: the addon starts again with what it saved, the game as it was
        play.world = reloadWorld(world);
        // Started again, the addon takes a tick or two to light what is due, as at a login
        play.shownGone = 0;
        note(play, "reload");
        return true;
    }
    if (!random.isChance(0.02)) return false;
    world.fire("PLAYER_ENTERING_WORLD");
    note(play, "zone");
    return true;
}

/** What the client hides this second, and what it says of it. It starts or stops hiding only at a moment the addon can tell. */
function playClient(play: Play, isMoment: boolean): void {
    const { world, random, profile } = play;
    const secrecy = world.state.auraSecrecy;
    let hasSaid = false;
    const change = (chance: number, apply: () => string): boolean => {
        if (!random.isChance(chance)) return false;
        note(play, apply());
        return true;
    };
    change(0.04, () => `list ${(secrecy.inList = random.pickOne(["omit", "secretFields", "error"] as const))}`);
    change(0.04, () => `direct ${(secrecy.direct = random.pickOne(["nil", "secretFields", "error"] as const))}`);
    if (secrecy.saysRestricted !== "missing") {
        hasSaid = change(0.04, () => `says restricted ${(secrecy.saysRestricted = random.pickOne(ANSWERS))}`);
    }
    hasSaid = change(0.04, () => `says secret ${(secrecy.saysSecret[profile.buff.id] = random.pickOne(ANSWERS))}`) || hasSaid;
    if (isMoment || hasSaid) change(0.5, () => `hiding ${(secrecy.isHiding = !secrecy.isHiding)}`);
    const icon = world.state.trackedBuffs[0];
    if (icon !== undefined) change(0.03, () => `icon secret ${(icon.isActiveSecret = icon.isActiveSecret !== true)}`);
    keepTrace(play);
}

/** Does C_Secrets say plainly that the buff's aura is not secret now (the auras not restricted, or the spell not secret)? */
function isSaidNotSecret(play: Play): boolean {
    const secrecy = play.world.state.auraSecrecy;
    const isRestrictedNo = secrecy.saysRestricted === false || secrecy.saysRestricted === "missing";
    const isSpellNo = secrecy.isSpellCallMissing || (secrecy.saysSecret[play.profile.buff.id] ?? secrecy.saysSecretOthers) === false;
    return isRestrictedNo || isSpellNo;
}

/**
 * A client that hides an aura leaves a trace of it: C_Secrets does not deny it, or the list or the direct question shows
 * something. One that hides it without any is no client to beat: the buff then is as gone, to the addon as to anyone.
 */
function keepTrace(play: Play): void {
    const secrecy = play.world.state.auraSecrecy;
    if (!secrecy.isHiding || !isSaidNotSecret(play) || secrecy.inList !== "omit" || secrecy.direct !== "nil") return;
    secrecy.inList = play.random.pickOne(["secretFields", "error"] as const);
    note(play, `list ${secrecy.inList} (a trace)`);
}

/** What the client hides and says now, for a failure. */
function describeClient(play: Play): string {
    const { state } = play.world;
    const s = state.auraSecrecy;
    const says = s.saysSecret[play.profile.buff.id] ?? s.saysSecretOthers;
    const icon = state.trackedBuffs[0];
    return [
        `hiding ${s.isHiding}, list ${s.inList}, direct ${s.direct}, says restricted ${tostring(s.saysRestricted)}`,
        `says secret ${s.isSpellCallMissing ? "(no call)" : tostring(says)}, fight ${state.isInCombat}, list empty ${state.areAurasHidden}`,
        `icon ${icon === undefined ? "none" : icon.isActiveSecret === true ? "secret" : "shown"}`,
    ].join(", ");
}

/** Is nothing hidden from the addon now, and nothing said to be? Then it must show the truth. */
function isAllShown(play: Play): boolean {
    const { state } = play.world;
    return !state.areAurasHidden && !state.auraSecrecy.isHiding && isSaidNotSecret(play);
}

/** Plays one second; undefined when all is well, else what went wrong. */
function playSecond(play: Play): string | undefined {
    const { world } = play;
    play.second += 1;
    playPlayer(play);
    playClient(play, playMoment(play));
    world.state.auras = world.state.auras.filter((aura) => aura.expirationTime > GetTime());
    const icon = world.state.trackedBuffs[0];
    if (icon !== undefined) icon.isActive = findBuff(play) !== undefined;
    world.advance(1);
    if (world.state.isPlayerDead) {
        play.shownGone = 0;
        return undefined;
    }
    const remain = readRemain(play);
    const glows = world.glowsOn(1) > 0;
    if (remain > LAST_SECONDS && glows) return `glows while up (${describeClient(play)})`;
    play.shownGone = isAllShown(play) && remain === 0 ? play.shownGone + 1 : 0;
    if (play.shownGone >= 2 && !glows) return "dark while gone, with nothing hidden";
    return undefined;
}

/** What went wrong in a case: its kind, and the seed, the second and what led to it. */
interface Failure {
    kind: string;
    text: string;
}

/** Plays a case; undefined when all went well. */
function playCase(profile: Profile, seed: number): Failure | undefined {
    let play: Play | undefined;
    for (let second = 1; second <= SECONDS; second++) {
        const [isDone, failure] = pcall(() => {
            play ??= createPlay(profile, seed);
            return playSecond(play);
        });
        const kind = isDone ? (failure === undefined ? undefined : string.match(failure, "^[^(]+")[0]?.trim()) : "Lua error";
        const detail = isDone ? (failure ?? "") : `Lua error (${tostring(failure)})`;
        if (kind !== undefined) {
            return { kind, text: `seed ${seed}, second ${second}: ${detail} | ${(play?.log ?? []).slice(-12).join(", ")}` };
        }
    }
    return undefined;
}

/** The failures counted by kind, and the first of each. */
function describeFailures(failures: Failure[]): string {
    const firsts = new LuaMap<string, { count: number; text: string }>();
    for (const failure of failures) {
        const seen = firsts.get(failure.kind);
        if (seen !== undefined) seen.count += 1;
        else firsts.set(failure.kind, { count: 1, text: failure.text });
    }
    const parts: string[] = [];
    for (const [kind, seen] of firsts) parts.push(`${kind}: ${seen.count} (first: ${seen.text})`);
    return `${failures.length} of ${CASES} cases failed${parts.length > 0 ? `; ${parts.join("; ")}` : ""}`;
}

PROFILES.forEach((profile, index) => {
    describe(`${profile.label}, its aura hidden at random`, () => {
        it("never glows while up, never breaks, and shows the truth whenever nothing is hidden", () => {
            const failures: Failure[] = [];
            for (let seed = 1; seed <= CASES; seed++) {
                const failure = playCase(profile, index * 1000 + seed);
                if (failure !== undefined) failures.push(failure);
            }
            expect(describeFailures(failures)).toBe(`0 of ${CASES} cases failed`);
        });
    });
});

/** Plays a case again, writing down each second from `from` on: for finding out what went wrong in one. */
export function traceCase(profileIndex: number, seed: number, from: number, to: number): string {
    const profile = PROFILES[profileIndex]!;
    const play = createPlay(profile, profileIndex * 1000 + seed);
    const lines: string[] = [];
    for (let second = 1; second <= to; second++) {
        const logged = play.log.length;
        playSecond(play);
        if (second >= from) {
            const glows = play.world.glowsOn(1);
            lines.push(
                `${second}s [${play.log.slice(logged).join("; ")}] remain ${math.floor(readRemain(play))} glows ${glows} (${describeClient(play)})`,
            );
        }
    }
    return lines.join("\n");
}

/** Plays one case of a buff (0 Battle Shout, 1 Fortitude, 2 an added buff, 3 a paladin's aura) by its seed: what went wrong, if anything. */
export function replayCase(profileIndex: number, seed: number): string | undefined {
    return playCase(PROFILES[profileIndex]!, profileIndex * 1000 + seed)?.text;
}
