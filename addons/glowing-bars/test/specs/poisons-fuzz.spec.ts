// A rogue's poisons at random: each rank on a button or not, some in the bags or none, the pick automatic or one chosen, the
// weapon coated or not. Nothing of a poison is learned: its items decide. Each case checks that a poison on a button is the
// one that glows (its highest rank in the bags, else its highest rank there), one in the bags only is told of in the
// message and glows nowhere, and nothing is asked for with no poison or a coated weapon. Each case is played from its seed.
import { createRandom, createWorld, describe, expect, it, playAs, ROGUE, type Random, type World } from "@wowkit/test-kit";

interface Rank {
    item: number;
    spell: number;
    name: string;
}

interface Poison {
    key: string;
    ranks: Rank[];
    /** An enchant the client shows while it is on the weapon. */
    enchant: number;
}

/** A few ranks of each poison, lowest first (from the game). */
const POISONS: Poison[] = [
    {
        key: "InstantPoison",
        enchant: 323,
        ranks: [
            { item: 6947, spell: 8679, name: "Instant Poison" },
            { item: 6950, spell: 8688, name: "Instant Poison III" },
            { item: 8928, spell: 11340, name: "Instant Poison VI" },
        ],
    },
    {
        key: "DeadlyPoison",
        enchant: 7,
        ranks: [
            { item: 2892, spell: 2823, name: "Deadly Poison" },
            { item: 8984, spell: 11355, name: "Deadly Poison III" },
        ],
    },
    { key: "CripplingPoison", enchant: 22, ranks: [{ item: 3775, spell: 3408, name: "Crippling Poison" }] },
    { key: "WoundPoison", enchant: 703, ranks: [{ item: 10918, spell: 13219, name: "Wound Poison" }] },
    { key: "MindNumbingPoison", enchant: 23, ranks: [{ item: 5237, spell: 5761, name: "Mind-numbing Poison" }] },
];
const MAIN_HAND = 16;
/** The main bar's buttons: their slots are the ones the test can see glow (8 ranks at most). */
const FIRST_SLOT = 1;
const CASES = 150;
/** Where the cases' seeds are drawn from: one after another, the generator's seeds would give cases alike. */
const SEEDS_SEED = 20261125;

/** One rank of a case: on a button (its slot) or not, and how many are in the bags. */
interface Placed extends Rank {
    poison: Poison;
    slot: number | undefined;
    count: number;
}

interface Case {
    placed: Placed[];
    /** The poison picked on the Settings page; undefined for the automatic pick. */
    chosen: Poison | undefined;
    coating: Poison | undefined;
    /** The poison put on last, in an earlier session (the one on the weapon, where it is coated). */
    last: Poison | undefined;
}

function makeCase(random: Random): Case {
    const placed: Placed[] = [];
    let slot = FIRST_SLOT;
    for (const poison of POISONS) {
        for (const rank of poison.ranks) {
            const isOnBar = random.isChance(0.3);
            const count = random.isChance(0.4) ? 1 + random.pickIndex(5) : 0;
            if (!isOnBar && count === 0) continue;
            placed.push({ ...rank, poison, slot: isOnBar ? slot++ : undefined, count });
        }
    }
    const chosen = random.isChance(0.4) ? random.pickOne(POISONS) : undefined;
    const coating = random.isChance(0.2) ? random.pickOne(POISONS) : undefined;
    // A poison put on before that has run out since: the automatic pick keeps it
    const last = coating ?? (random.isChance(0.3) ? random.pickOne(POISONS) : undefined);
    return { placed, chosen, coating, last };
}

function createCaseWorld(testCase: Case): World {
    const saved: Record<string, unknown> = { styles: { weaponBuff: { isMessageOn: true } } };
    if (testCase.chosen !== undefined) saved.weaponBuff = testCase.chosen.key;
    // The poison put on last, in an earlier session: the addon noted it (by its first rank's spell)
    if (testCase.last !== undefined) saved.lastBuffs = { "weapon:main": testCase.last.ranks[0]!.spell };
    const world = createWorld((state) => {
        playAs(state, ROGUE);
        state.equippedItems[MAIN_HAND] = 1234;
        for (const rank of testCase.placed) {
            state.spells[rank.spell] = { id: rank.spell, name: rank.name, rank: 1, icon: rank.spell, isHelpful: true };
            state.itemUseSpells[rank.item] = rank.spell;
            state.bags[rank.item] = rank.count;
            if (rank.slot !== undefined) state.barItems[rank.slot] = rank.item;
        }
        if (testCase.coating !== undefined)
            state.enchants[MAIN_HAND] = { enchantID: testCase.coating.enchant, remainingTimeMs: 3600 * 1000 };
    }, saved);
    world.advance(2);
    return world;
}

/** The rank of a poison that glows: the highest on a button with some in the bags, else the highest on a button. */
function findGlowingRank(testCase: Case, poison: Poison): Placed | undefined {
    const onBars = testCase.placed.filter((rank) => rank.poison === poison && rank.slot !== undefined);
    const owned = onBars.filter((rank) => rank.count > 0);
    return owned[owned.length - 1] ?? onBars[onBars.length - 1];
}

function check(isTrue: boolean, what: string): void {
    if (!isTrue) throw what;
}

const isOnBars = (testCase: Case, poison: Poison) => testCase.placed.some((rank) => rank.poison === poison && rank.slot !== undefined);
const isThere = (testCase: Case, poison: Poison) =>
    testCase.placed.some((rank) => rank.poison === poison && (rank.slot !== undefined || rank.count > 0));

/**
 * The poison asked for by name: the one chosen, else the one put on last (the automatic pick keeps it), where there is some
 * of it; undefined for the automatic pick among the others.
 */
function findNamedPoison(testCase: Case): Poison | undefined {
    if (testCase.chosen !== undefined && isThere(testCase, testCase.chosen)) return testCase.chosen;
    return testCase.last !== undefined && isThere(testCase, testCase.last) ? testCase.last : undefined;
}

/** One button glows, of the poison asked for (any on a button for the automatic pick), at the rank that should. */
function checkGlowing(glowing: Placed[], testCase: Case, named: Poison | undefined): void {
    check(glowing.length === 1, `${glowing.length} buttons glow (${glowing.map((rank) => rank.name).join(", ")})`);
    const shown = glowing[0]!;
    check(named === undefined || shown.poison === named, `${shown.name} glows, not ${named?.key}`);
    check(findGlowingRank(testCase, shown.poison) === shown, `${shown.name} glows, not the rank that should`);
}

function checkCase(world: World, testCase: Case): void {
    const glowing = testCase.placed.filter((rank) => rank.slot !== undefined && world.glowsOn(rank.slot) > 0);
    const isTold = (world.notice() ?? "").includes("Weapon buff");
    const named = findNamedPoison(testCase);
    if (testCase.coating !== undefined) {
        // The poison on the weapon is the one asked for: quiet. Another one chosen: asked for, as with no poison on. The
        // automatic pick with the poison on nowhere: not judged
        if (named === testCase.coating) check(glowing.length === 0 && !isTold, "the poison on the weapon is asked for again");
        if (named === undefined || named === testCase.coating) return;
    }
    const isAskedOnBars = named !== undefined ? isOnBars(testCase, named) : POISONS.some((poison) => isOnBars(testCase, poison));
    if (isAskedOnBars) return checkGlowing(glowing, testCase, named);
    // On no button: told of in the message, where there is some of it, and nothing glows
    check(glowing.length === 0, "a poison glows though the one asked for is on no button");
    const isAny = named !== undefined || POISONS.some((poison) => isThere(testCase, poison));
    check(isTold === isAny, `told: ${tostring(isTold)}`);
}

function playCase(seed: number): string | undefined {
    const testCase = makeCase(createRandom(seed));
    const [isDone, failure] = pcall(() => checkCase(createCaseWorld(testCase), testCase));
    if (isDone) return undefined;
    const placed = testCase.placed.map((rank) => `${rank.name}@${tostring(rank.slot)}x${rank.count}`).join(", ");
    return `seed ${seed}: ${tostring(failure)} | chosen ${testCase.chosen?.key ?? "auto"}, coated ${testCase.coating?.key ?? "no"}; ${placed}`;
}

describe("a rogue's poisons at random", () => {
    it("glow on a button where there is one, are told of from the bags, and keep quiet with none or a coated weapon", () => {
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
