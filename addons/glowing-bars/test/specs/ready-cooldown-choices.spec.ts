// Every When and glow time a ready cooldown can have (In combat + start among the Whens), against what each promises: in peace, as a fight
// starts, and later in it, for a cooldown ready the whole time, one back during the fight, and one used in it.
import { createWorld, describe, expect, it, learnSpell, playAs, targetEnemy, WARRIOR, type SpellDefinition } from "@wowkit/test-kit";

const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 1800 };
// Alert in town is offered only to low reagents and low stock; Enemy targeted is tried with an enemy targeted
const WHENS = ["always", "inCombat", "inCombatStart", "outOfCombat", "enemyTargeted"] as const;
type When = (typeof WHENS)[number];

/** May the glow show out of combat, and in a fight? (Enemy targeted: one always is.) */
const isAllowedInPeace = (when: When) => when !== "inCombat" && when !== "inCombatStart";
const isAllowedInFight = (when: When) => when !== "outOfCombat";

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

function describeCase(c: Case): string {
    return `${c.when}/${c.glowTime === 0 ? "until done" : "3 s"}`;
}

describe("a ready cooldown by every When and glow time", () => {
    it("ready the whole time: in peace, as the fight starts, and later in it", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            const world = createWarrior(c);
            world.advance(1);
            const peace = world.glowsOn(2);
            world.state.isInCombat = true;
            world.fire("PLAYER_REGEN_DISABLED");
            world.advance(0.5);
            const start = world.glowsOn(2);
            world.advance(6);
            const late = world.glowsOn(2);
            // Before the fight it glows where it may, within its glow time; in the fight, once it may and is a candidate
            // In combat glows only once it comes back; In combat + start as the fight starts too
            const isCandidate = c.when !== "inCombat";
            const wantPeace = isAllowedInPeace(c.when) ? 1 : 0;
            const wantStart = isAllowedInFight(c.when) && isCandidate ? 1 : 0;
            const wantLate = c.glowTime === 0 ? wantStart : 0;
            const got = `${peace}${start}${late}`;
            const want = `${wantPeace}${wantStart}${wantLate}`;
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
            const wantBack = isAllowedInFight(c.when) ? 1 : 0;
            const got = `${peace}${start}${back}${late}`;
            const want = `00${wantBack}${c.glowTime === 0 ? wantBack : 0}`;
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
