// Every When and glow time a ready cooldown can have, against what each promises: in peace, as a fight starts, later in it,
// and as it ends, for a cooldown ready the whole time, one back during the fight, and one used in it. A ready cooldown glows
// once, as it is ready while its When holds; a "+ start" choice also as its time begins (a fight's start, or its end).
import { createWorld, describe, expect, it, learnSpell, playAs, targetEnemy, WARRIOR, type SpellDefinition } from "@wowkit/test-kit";

const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 1800 };
// Alert in town is offered only to low reagents and low stock; Enemy targeted is tried with an enemy targeted
const WHENS = ["always", "alwaysStart", "inCombat", "inCombatStart", "outOfCombat", "outOfCombatStart", "enemyTargeted"] as const;
type When = (typeof WHENS)[number];

/** May the glow show out of combat, and in a fight? (Enemy targeted: one always is.) */
const isAllowedInPeace = (when: When) => when !== "inCombat" && when !== "inCombatStart";
const isAllowedInFight = (when: When) => when !== "outOfCombat" && when !== "outOfCombatStart";
/** Does it glow again as the time of its When begins, ready then: a fight's start, or (Out of combat + start) its end? */
const isStartingAtFight = (when: When) => when === "inCombatStart" || when === "alwaysStart";
/** Does it glow after the fight, ready since before: only Until done, and Out of combat + start? */
const wantAfterFight = (c: Case) => (isAllowedInPeace(c.when) && (c.glowTime === 0 || c.when === "outOfCombatStart") ? 1 : 0);

interface Case {
    when: When;
    /** 3 seconds, or 0: until done. */
    glowTime: number;
}

function listCases(): Case[] {
    const cases: Case[] = [];
    for (const when of WHENS) for (const glowTime of [3, 0]) cases.push({ when, glowTime });
    return cases;
}

function createWarrior(c: Case) {
    return createWorld(
        (state) => {
            playAs(state, WARRIOR);
            learnSpell(state, RECKLESSNESS);
            state.bars[2] = RECKLESSNESS.id;
            targetEnemy(state);
        },
        { styles: { readyCooldown: { when: c.when, glowTime: c.glowTime } } },
    );
}

/** The fight ends; a tick after. */
function endFight(world: ReturnType<typeof createWarrior>): void {
    world.state.isInCombat = false;
    world.fire("PLAYER_REGEN_ENABLED");
    world.advance(0.5);
}

function describeCase(c: Case): string {
    return `${c.when}/${c.glowTime === 0 ? "until done" : "3 s"}`;
}

describe("a ready cooldown by every When and glow time", () => {
    it("ready the whole time: in peace, as the fight starts after its glow time, later in it, and after it", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            const world = createWarrior(c);
            world.advance(1);
            const peace = world.glowsOn(2);
            world.advance(5);
            world.state.isInCombat = true;
            world.fire("PLAYER_REGEN_DISABLED");
            world.advance(0.5);
            const start = world.glowsOn(2);
            world.advance(6);
            const late = world.glowsOn(2);
            endFight(world);
            const after = world.glowsOn(2);
            // It glowed before the fight, where it may: as the fight starts only a "+ start" choice glows again; Until done
            // the whole time it may (In combat only once it comes back)
            const isCandidate = c.when !== "inCombat";
            const wantPeace = isAllowedInPeace(c.when) ? 1 : 0;
            const wantStart = isAllowedInFight(c.when) && isCandidate && (c.glowTime === 0 || isStartingAtFight(c.when)) ? 1 : 0;
            const wantLate = c.glowTime === 0 ? wantStart : 0;
            const got = `${peace}${start}${late}${after}`;
            const want = `${wantPeace}${wantStart}${wantLate}${wantAfterFight(c)}`;
            if (got !== want) wrong.push(`${describeCase(c)}: ${got}, want ${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("on cooldown as the fight starts, back during it", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            const world = createWarrior(c);
            world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
            world.advance(1);
            const peace = world.glowsOn(2);
            world.state.isInCombat = true;
            world.fire("PLAYER_REGEN_DISABLED");
            world.advance(0.5);
            const start = world.glowsOn(2);
            world.state.cooldowns[RECKLESSNESS.id] = undefined;
            world.advance(0.5);
            const back = world.glowsOn(2);
            world.advance(6);
            const late = world.glowsOn(2);
            endFight(world);
            const after = world.glowsOn(2);
            // Out of combat does not glow after the fight for what was ready in it: its time was then
            const wantBack = isAllowedInFight(c.when) ? 1 : 0;
            const got = `${peace}${start}${back}${late}${after}`;
            const want = `00${wantBack}${c.glowTime === 0 ? wantBack : 0}${wantAfterFight(c)}`;
            if (got !== want) wrong.push(`${describeCase(c)}: ${got}, want ${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("used in the fight, back during it", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            const world = createWarrior(c);
            world.advance(1);
            world.state.isInCombat = true;
            world.fire("PLAYER_REGEN_DISABLED");
            world.advance(6);
            world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", RECKLESSNESS.id);
            world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
            world.advance(1);
            const used = world.glowsOn(2);
            world.state.cooldowns[RECKLESSNESS.id] = undefined;
            world.advance(0.5);
            const back = world.glowsOn(2);
            const wantBack = isAllowedInFight(c.when) ? 1 : 0;
            const got = `${used}${back}`;
            const want = `0${wantBack}`;
            if (got !== want) wrong.push(`${describeCase(c)}: ${got}, want ${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });
});
