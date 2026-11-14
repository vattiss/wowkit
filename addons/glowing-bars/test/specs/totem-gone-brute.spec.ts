// The totems gone, searched by brute force: drops, replacements, losses, Totemic Recall and fights in random but repeatable
// orders, the slot's change sometimes before the cast and sometimes twice on a replacement, as the game may send them. After
// each step a totem's button glows exactly while it is the last dropped in its element and that element's totem is gone.
import { createWorld, describe, expect, it, learnSpell, playAs, SHAMAN, type SpellDefinition, type World } from "@wowkit/test-kit";

const totem = (id: number, name: string): SpellDefinition => ({ id, name, rank: 1, icon: 100000 + id, isHelpful: true });
/** Two totems of fire and one of each other element, on buttons 1 to 5. */
const TOTEMS: [spell: SpellDefinition, slot: number][] = [
    [totem(3599, "Searing Totem"), 1],
    [totem(8190, "Magma Totem"), 1],
    [totem(8075, "Strength of Earth Totem"), 2],
    [totem(5675, "Mana Spring Totem"), 3],
    [totem(8512, "Windfury Totem"), 4],
];
const RECALL = totem(36936, "Totemic Recall");
const SEQUENCES = 60;
const STEPS = 20;
/** Time for the addon to tell a loss from a drop, and a tick (0.9 s out of a fight). */
const SETTLE = 2.2;

interface Truth {
    standing: Map<number, boolean>;
    gone: Map<number, boolean>;
    last: Map<number, number>;
    isInCombat: boolean;
}

function createRandom(seed: number): (count: number) => number {
    let value = seed;
    return (count) => {
        value = (value * 16807) % 2147483647;
        return math.floor((value / 2147483647) * count);
    };
}

function createShaman(): World {
    const world = createWorld(
        (state) => {
            playAs(state, SHAMAN);
            for (const [spell] of TOTEMS) learnSpell(state, spell);
            learnSpell(state, RECALL);
            TOTEMS.forEach(([spell], index) => (state.bars[index + 1] = spell.id));
            state.totemSpells = { 1: [3599, 8190], 2: [8075], 3: [5675], 4: [8512] };
        },
        { styles: { totemGone: { glowTime: 0 } } },
    );
    world.advance(1);
    return world;
}

/** A drop: the slot changes (twice, when it replaces one) near the cast, before or after it. */
function runDrop(world: World, truth: Truth, pick: (count: number) => number): string {
    const [spell, slot] = TOTEMS[pick(TOTEMS.length)]!;
    const isChangeFirst = pick(2) === 0;
    const changes = truth.standing.get(slot) === true && pick(2) === 0 ? 2 : 1;
    const fireChanges = () => {
        for (let index = 0; index < changes; index++) world.fire("PLAYER_TOTEM_UPDATE", slot);
    };
    world.state.totems[slot] = { name: spell.name, start: GetTime(), duration: 120 };
    if (isChangeFirst) fireChanges();
    world.advance(0.3);
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", spell.id);
    if (!isChangeFirst) fireChanges();
    truth.standing.set(slot, true);
    truth.gone.set(slot, false);
    truth.last.set(slot, spell.id);
    return `drop ${spell.name}${isChangeFirst ? " (change first)" : ""}${changes === 2 ? " (two changes)" : ""}`;
}

function runLose(world: World, truth: Truth, pick: (count: number) => number): string {
    const slot = 1 + pick(4);
    if (truth.standing.get(slot) !== true) return "nothing to lose";
    world.state.totems[slot] = undefined;
    world.fire("PLAYER_TOTEM_UPDATE", slot);
    truth.standing.set(slot, false);
    truth.gone.set(slot, true);
    return `lose slot ${slot}`;
}

function runRecall(world: World, truth: Truth): string {
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", RECALL.id);
    for (let slot = 1; slot <= 4; slot++) {
        if (truth.standing.get(slot) !== true) continue;
        world.state.totems[slot] = undefined;
        world.fire("PLAYER_TOTEM_UPDATE", slot);
        truth.standing.set(slot, false);
        truth.gone.set(slot, false);
    }
    return "Totemic Recall";
}

function runFight(world: World, truth: Truth): string {
    truth.isInCombat = !truth.isInCombat;
    world.state.isInCombat = truth.isInCombat;
    world.state.areTotemsHidden = truth.isInCombat;
    world.fire(truth.isInCombat ? "PLAYER_REGEN_DISABLED" : "PLAYER_REGEN_ENABLED");
    return truth.isInCombat ? "fight starts" : "fight ends";
}

function runStep(world: World, truth: Truth, pick: (count: number) => number): string {
    const kind = pick(10);
    if (kind < 4) return runDrop(world, truth, pick);
    if (kind < 7) return runLose(world, truth, pick);
    if (kind === 7) return runRecall(world, truth);
    if (kind === 8) return runFight(world, truth);
    world.advance(1 + pick(30));
    return "wait";
}

/** What is wrong on the totems' buttons now. */
function findWrong(world: World, truth: Truth): string[] {
    const wrong: string[] = [];
    TOTEMS.forEach(([spell, slot], index) => {
        const want = truth.gone.get(slot) === true && truth.last.get(slot) === spell.id;
        const got = world.glowsOn(index + 1) > 0;
        if (got !== want) wrong.push(`${spell.name}: glow ${tostring(got)}, want ${tostring(want)}`);
    });
    return wrong;
}

function runSequence(seed: number): string | undefined {
    const pick = createRandom(seed);
    const world = createShaman();
    const truth: Truth = { standing: new Map(), gone: new Map(), last: new Map(), isInCombat: false };
    const steps: string[] = [];
    for (let step = 0; step < STEPS; step++) {
        steps.push(runStep(world, truth, pick));
        world.advance(SETTLE);
        const wrong = findWrong(world, truth);
        if (wrong.length > 0) return `seed ${seed}: ${steps.join(", ")} -> ${wrong.join("; ")}`;
    }
    return undefined;
}

describe("a shaman's totems gone in random orders (issue #48)", () => {
    it("lights the last totem of each element exactly while its totem is gone", () => {
        const failures: string[] = [];
        for (let seed = 1; seed <= SEQUENCES; seed++) {
            const failure = runSequence(seed);
            if (failure !== undefined) failures.push(failure);
        }
        expect(`${failures.length} wrong: ${failures.slice(0, 3).join(" | ")}`).toBe("0 wrong: ");
    });
});
