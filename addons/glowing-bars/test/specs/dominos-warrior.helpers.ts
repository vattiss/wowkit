// A warrior who plays with Dominos, for the search of issue #72 (ready cooldowns that glow mid-fight though long ready).
// Dominos pages its bar the way its secure state driver does, with no event of the game's: Shift first, then an enemy
// target, else the stance. The truth of what should glow is kept beside the game: a ready cooldown glows in a fight once
// it was on cooldown in that fight and is ready again, on the buttons that show it.
import { createWorld, learnSpell, playAs, WARRIOR, type ClientState, type SpellDefinition, type World } from "@wowkit/test-kit";

const spell = (id: number, name: string, cooldownSeconds: number): SpellDefinition => ({
    id,
    name,
    rank: 1,
    // Each its own icon, as in the game: the addon also finds buttons by their icon
    icon: 100000 + id,
    cooldownSeconds,
    isHelpful: true,
});

/** The warrior's ready cooldowns of the addon's list, with their cooldowns. */
export const COOLDOWNS: SpellDefinition[] = [
    spell(2687, "Bloodrage", 60),
    spell(18499, "Berserker Rage", 30),
    spell(20230, "Retaliation", 1800),
    spell(871, "Shield Wall", 1800),
    spell(12975, "Last Stand", 600),
    spell(1719, "Recklessness", 1800),
    spell(12328, "Death Wish", 180),
];
const [BLOODRAGE, BERSERKER_RAGE, RETALIATION, SHIELD_WALL, LAST_STAND, RECKLESSNESS, DEATH_WISH] = COOLDOWNS as [
    SpellDefinition,
    SpellDefinition,
    SpellDefinition,
    SpellDefinition,
    SpellDefinition,
    SpellDefinition,
    SpellDefinition,
];

/** The stances, as the stance bar has them. */
export const STANCES = [spell(2457, "Battle Stance", 0), spell(71, "Defensive Stance", 0), spell(2458, "Berserker Stance", 0)];

/** Each page of the Dominos bar: the slot before its first button, and what its first three buttons hold. */
const PAGES = {
    battle: { base: 72, spells: [BLOODRAGE, RETALIATION, DEATH_WISH] },
    defensive: { base: 84, spells: [SHIELD_WALL, BLOODRAGE, LAST_STAND] },
    berserker: { base: 96, spells: [BERSERKER_RAGE, RECKLESSNESS, BLOODRAGE] },
    enemy: { base: 108, spells: [LAST_STAND, DEATH_WISH, RECKLESSNESS] },
    shift: { base: 120, spells: [RETALIATION, SHIELD_WALL, BERSERKER_RAGE] },
};
const STANCE_PAGES = [PAGES.battle, PAGES.defensive, PAGES.berserker];
/** The Dominos bar the test pages: its buttons 13 to 24 in the fake game. */
export const DOMINOS_BUTTONS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((id) => `DominosActionButton${id}`);
/** Under this many seconds left, a cooldown may count as over or not: the addon's margin and the clock's step. */
const UNSURE_SECONDS = 0.5;
/** For this long after its end, the glow may not show yet: the addon looks again at its next tick (every 0.5 s in a fight). */
const TICK_SECONDS = 0.8;
/** The step the time goes by in, for adding up how long each glow was seen. */
const TIME_STEP = 0.1;
/** How far the addon's count of a glow seen may be off: it looks every 0.5 s in a fight, so more at each page change. */
const COUNT_SLACK = 0.8;
const PAGE_CHANGE_SLACK = 0.5;

/** The warrior's world beside the truth of the fight. */
export interface Fight {
    world: World;
    stance: number;
    isShiftHeld: boolean;
    isEnemyTargeted: boolean;
    isInCombat: boolean;
    /** Spell ID -> when its own cooldown ends (not the global cooldown). */
    endsAt: Map<number, number>;
    /** The spells on cooldown at some time in this fight. */
    usedInFight: Set<number>;
    /** The spells all but over as the fight began: whether the addon counted them as running is not for the truth to say. */
    unsureInFight: Set<number>;
    /** The glow time of the ready cooldowns: 0 is until done. */
    glowTime: number;
    /** Is the When of the ready cooldowns In combat + start: those ready on a button glow as a fight starts too? */
    isFightStartOn: boolean;
    /** Spell ID -> how long it has been due while a button showed it (only the seen time counts against the glow time). */
    shownFor: Map<number, number>;
    /** Spell ID -> how far the addon's count of it may be off, and whether a button showed it at the last step. */
    slack: Map<number, number>;
    wasShown: Set<number>;
}

/** A warrior in Battle Stance, with Dominos, out of combat; each cooldown ready or running, by `startLeft` (seconds). */
export function createFight(startLeft: number[], glowTime: number, isFightStartOn = false): Fight {
    const world = createWorld(
        (state) => {
            playAs(state, WARRIOR);
            state.hasDominos = true;
            for (const known of [...COOLDOWNS, ...STANCES]) learnSpell(state, known);
            state.stances = STANCES.map((stance) => stance.id);
            state.activeStance = STANCES[0]!.id;
            for (const page of Object.values(PAGES)) page.spells.forEach((known, index) => (state.bars[page.base + 1 + index] = known.id));
        },
        {
            isMissingBuffEnabled: false,
            isProcEnabled: false,
            styles: { readyCooldown: { glowTime, when: isFightStartOn ? "inCombatStart" : "inCombat" } },
        },
    );
    const fight: Fight = {
        world,
        stance: 0,
        isShiftHeld: false,
        isEnemyTargeted: false,
        isInCombat: false,
        endsAt: new Map(),
        usedInFight: new Set(),
        unsureInFight: new Set(),
        glowTime,
        isFightStartOn,
        shownFor: new Map(),
        slack: new Map(),
        wasShown: new Set(),
    };
    COOLDOWNS.forEach((known, index) => {
        const left = startLeft[index] ?? 0;
        if (left <= 0) return;
        world.state.cooldowns[known.id] = { start: GetTime(), duration: left };
        fight.endsAt.set(known.id, GetTime() + left);
    });
    applyPage(fight);
    world.advance(1);
    return fight;
}

/** Dominos's buttons show the page of the state: Shift, then an enemy target, then the stance. */
export function applyPage(fight: Fight): void {
    const page = fight.isShiftHeld ? PAGES.shift : fight.isEnemyTargeted ? PAGES.enemy : STANCE_PAGES[fight.stance]!;
    DOMINOS_BUTTONS.forEach((name, index) => {
        const button = fight.world.findFrame((frame) => frame.name === name);
        if (button !== undefined) button.action = page.base + 1 + index;
    });
}

/** Seconds left on the spell's own cooldown, by the truth. */
/** As a fight begins: is the cooldown running (the addon counts one of more than 0.2 s left), or all but over? */
export function readFightStart(fight: Fight, spellId: number): "running" | "unsure" | "ready" {
    const left = readLeft(fight, spellId);
    return left > UNSURE_SECONDS ? "running" : left > 0 ? "unsure" : "ready";
}

export function readLeft(fight: Fight, spellId: number): number {
    return Math.max((fight.endsAt.get(spellId) ?? 0) - GetTime(), 0);
}

/** Is the spell due by the truth: ready again in a fight it was on cooldown in? */
function isDue(fight: Fight, spellId: number): boolean {
    return fight.isInCombat && fight.usedInFight.has(spellId) && readLeft(fight, spellId) === 0;
}

/** Should the spell glow now: true, false, or undefined while it is too close to an edge to say? */
export function isGlowExpected(fight: Fight, spellId: number): boolean | undefined {
    const left = readLeft(fight, spellId);
    const endsAt = fight.endsAt.get(spellId);
    if (left > 0 && left <= UNSURE_SECONDS) return undefined;
    if (fight.unsureInFight.has(spellId)) return undefined;
    if (endsAt !== undefined && left === 0 && GetTime() - endsAt < TICK_SECONDS) return undefined;
    if (!isDue(fight, spellId) || fight.glowTime === 0) return isDue(fight, spellId);
    // A glow time: it shows until it has been seen that long
    const shownFor = fight.shownFor.get(spellId) ?? 0;
    const slack = COUNT_SLACK + (fight.slack.get(spellId) ?? 0);
    if (Math.abs(shownFor - fight.glowTime) <= slack) return undefined;
    return shownFor < fight.glowTime;
}

/** The spell starts over: it went on cooldown, or a fight began or ended. */
export function forgetShown(fight: Fight, spellId: number): void {
    fight.shownFor.delete(spellId);
    fight.slack.delete(spellId);
}

/** The spells a Dominos button shows now. */
export function listShownSpells(fight: Fight): Set<number> {
    const shown = new Set<number>();
    for (const name of DOMINOS_BUTTONS) {
        const spellId = readSlotSpell(fight.world.state, fight.world.findFrame((frame) => frame.name === name)?.action);
        if (spellId !== undefined) shown.add(spellId);
    }
    return shown;
}

/** Time goes by, and each due cooldown a button shows adds to the time it was seen. */
export function runTime(fight: Fight, seconds: number): void {
    for (let passed = 0; passed < seconds - 1e-6; passed += TIME_STEP) {
        const shown = listShownSpells(fight);
        for (const known of COOLDOWNS) {
            const id = known.id;
            const isShown = shown.has(id);
            if (isDue(fight, id) && isShown !== fight.wasShown.has(id)) fight.slack.set(id, (fight.slack.get(id) ?? 0) + PAGE_CHANGE_SLACK);
            if (isDue(fight, id) && isShown) fight.shownFor.set(id, (fight.shownFor.get(id) ?? 0) + TIME_STEP);
            if (isShown) fight.wasShown.add(id);
            else fight.wasShown.delete(id);
        }
        fight.world.advance(TIME_STEP);
    }
}

/** The spell the slot holds in the fake game. */
export function readSlotSpell(state: ClientState, slot: unknown): number | undefined {
    return typeof slot === "number" ? state.bars[slot] : undefined;
}
