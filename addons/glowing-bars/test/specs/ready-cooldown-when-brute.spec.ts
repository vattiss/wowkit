// The When of a ready cooldown, searched by brute force: fights starting and ending, an enemy targeted and let go, the
// cooldown used and back, in random but repeatable orders, for each When. After each step the button glows exactly as the
// rule says: a ready cooldown glows once, for its glow time, from when it is ready while its When holds; a "+ start" choice
// (and Enemy targeted, with a new enemy) also from when its time begins. Never later, out of its time.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    targetEnemy,
    WARRIOR,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 1800 };
const WHENS = [
    "always",
    "alwaysStart",
    "inCombat",
    "inCombatStart",
    "outOfCombat",
    "outOfCombatStart",
    "enemyTargeted",
    "anyTargeted",
] as const;
type When = (typeof WHENS)[number];
const SEQUENCES = 6;
const STEPS = 30;
const GLOW_TIME = 3;
/** A tick comes within this long of a change (0.9 s out of a fight): a glow near its start may be either way. */
const LEEWAY = 1.2;
/** Its start and its end both wait for a tick: a glow may end this long after its time. */
const LATE_END = 2.1;

/** What the test knows: the fight, the target, the cooldown, and when each changed. */
interface Truth {
    isInCombat: boolean;
    hasTarget: boolean;
    isReady: boolean;
    readyAt: number;
    fightStartAt: number;
    fightEndAt: number;
    /** When Enemy targeted last came to hold: an enemy targeted out of a fight, or a fight begun with none. */
    enemyOnAt: number;
}

function createRandom(seed: number): (count: number) => number {
    let value = seed;
    return (count) => {
        value = (value * 16807) % 2147483647;
        return math.floor((value / 2147483647) * count);
    };
}

function isAllowed(when: When, truth: Truth): boolean {
    if (when === "inCombat" || when === "inCombatStart") return truth.isInCombat;
    if (when === "outOfCombat" || when === "outOfCombatStart") return !truth.isInCombat;
    // The target is an enemy: Enemy and Any targeted hold with it, and in a fight
    return when === "enemyTargeted" || when === "anyTargeted" ? truth.hasTarget || truth.isInCombat : true;
}

/** When the glow began by the rule, or undefined when it may not glow at all now. */
function findGlowStart(when: When, truth: Truth): number | undefined {
    if (!truth.isReady || !isAllowed(when, truth)) return undefined;
    // In combat glows only for what came back in this fight; In combat + start as the fight starts too
    if (when === "inCombat") return truth.readyAt > truth.fightStartAt ? truth.readyAt : undefined;
    const startAt =
        when === "inCombatStart" || when === "alwaysStart"
            ? truth.fightStartAt
            : when === "outOfCombatStart"
              ? truth.fightEndAt
              : when === "enemyTargeted" || when === "anyTargeted"
                ? truth.enemyOnAt
                : -100;
    return math.max(truth.readyAt, startAt);
}

function toggleFight(world: World, truth: Truth, now: number): string {
    truth.isInCombat = !truth.isInCombat;
    world.state.isInCombat = truth.isInCombat;
    world.fire(truth.isInCombat ? "PLAYER_REGEN_DISABLED" : "PLAYER_REGEN_ENABLED");
    if (truth.isInCombat) truth.fightStartAt = now;
    else truth.fightEndAt = now;
    return truth.isInCombat ? "fight" : "peace";
}

function toggleTarget(world: World, truth: Truth): string {
    truth.hasTarget = !truth.hasTarget;
    if (truth.hasTarget) targetEnemy(world.state);
    else world.state.target = undefined;
    world.fire("PLAYER_TARGET_CHANGED");
    return truth.hasTarget ? "target" : "untarget";
}

function toggleReady(world: World, truth: Truth, now: number): string {
    truth.isReady = !truth.isReady;
    world.state.cooldowns[RECKLESSNESS.id] = truth.isReady ? undefined : { start: 0, duration: 99999 };
    if (truth.isReady) truth.readyAt = now;
    return truth.isReady ? "ready" : "used";
}

/** One random change, told in the step's words. */
function runStep(world: World, truth: Truth, pick: (count: number) => number): string {
    const now = GetTime();
    const kind = pick(5);
    const wasEnemyOn = truth.hasTarget || truth.isInCombat;
    const told = kind === 0 ? toggleFight(world, truth, now) : kind === 1 ? toggleTarget(world, truth) : undefined;
    if (!wasEnemyOn && (truth.hasTarget || truth.isInCombat)) truth.enemyOnAt = now;
    if (told !== undefined) return told;
    if (kind === 2) return toggleReady(world, truth, now);
    const seconds = 0.5 + pick(8) * 0.5;
    world.advance(seconds);
    return string.format("wait %.1f", seconds);
}

describe("a ready cooldown's When, by brute force", () => {
    it("glows once from when it is ready in its time, or as its time begins: never after, out of its time", () => {
        const wrong: string[] = [];
        for (const when of WHENS) {
            for (let seed = 1; seed <= SEQUENCES; seed++) {
                const world = createWorld(
                    (state) => {
                        playAs(state, WARRIOR);
                        learnSpell(state, RECKLESSNESS);
                        state.bars[2] = RECKLESSNESS.id;
                    },
                    { styles: { readyCooldown: { when, glowTime: GLOW_TIME } } },
                );
                const truth: Truth = {
                    isInCombat: false,
                    hasTarget: false,
                    // Ready at the login: it was so before, and glows only as a time of its When begins
                    isReady: true,
                    readyAt: -100,
                    fightStartAt: -100,
                    fightEndAt: -100,
                    enemyOnAt: -100,
                };
                const pick = createRandom(seed * 7919 + WHENS.indexOf(when));
                const steps: string[] = [];
                for (let step = 0; step < STEPS && wrong.length < 5; step++) {
                    steps.push(runStep(world, truth, pick));
                    // A tick sees the change; the cooldown stays as it is that long, so a fight sees it used
                    world.advance(LEEWAY);
                    const from = findGlowStart(when, truth);
                    const elapsed = from !== undefined ? GetTime() - from : undefined;
                    if (elapsed !== undefined && elapsed > GLOW_TIME - LEEWAY && elapsed < GLOW_TIME + LATE_END) continue;
                    const want = elapsed !== undefined && elapsed < GLOW_TIME ? 1 : 0;
                    if (world.glowsOn(2) !== want) wrong.push(`${when} #${seed}: ${steps.join(", ")} -> ${world.glowsOn(2)}, want ${want}`);
                }
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });
});
