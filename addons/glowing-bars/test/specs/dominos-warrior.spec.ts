// Issue #72, searched by brute force: a warrior with Dominos casts, changes stance, holds Shift, changes target, waits and
// fights, in random but repeatable orders. After every step each Dominos button must glow exactly when the spell it shows
// is a ready cooldown that was on cooldown in this fight. A failure prints its seed and steps.
import { describe, expect, it, targetEnemy } from "@wowkit/test-kit";
import {
    applyPage,
    COOLDOWNS,
    createFight,
    DOMINOS_BUTTONS,
    forgetShown,
    isGlowExpected,
    listShownSpells,
    readFightStart,
    readLeft,
    readSlotSpell,
    runTime,
    STANCES,
    type Fight,
} from "./dominos-warrior.helpers";

const SEQUENCES = 40;
const STEPS = 25;
const STEP_KINDS = ["cast", "cast", "cast", "stance", "stance", "shift", "shift", "target", "target", "wait", "wait", "combat"];
/** The global cooldown the other spells get from a cast. */
const GLOBAL_COOLDOWN = 1.5;
/** How long Dominos's state driver may take to page, in the sequences that model it. */
const PAGE_DELAY = 0.1;
/** Time for the addon to see a change: the page check, the map of the bars over a few frames, and a tick. */
const SETTLE = 1;

/** Repeatable random numbers (Park and Miller): a whole number below `count`. */
function createRandom(seed: number): (count: number) => number {
    let value = seed;
    return (count) => {
        value = (value * 16807) % 2147483647;
        return math.floor((value / 2147483647) * count);
    };
}

function runCast(fight: Fight, pick: (count: number) => number): string {
    const ready = COOLDOWNS.filter((known) => readLeft(fight, known.id) === 0);
    const cast = ready[pick(ready.length)];
    if (cast === undefined) return "cast nothing";
    const state = fight.world.state;
    const now = GetTime();
    for (const other of ready) state.cooldowns[other.id] = { start: now, duration: GLOBAL_COOLDOWN };
    state.cooldowns[cast.id] = { start: now, duration: cast.cooldownSeconds! };
    fight.endsAt.set(cast.id, now + cast.cooldownSeconds!);
    forgetShown(fight, cast.id);
    if (fight.isInCombat) fight.usedInFight.add(cast.id);
    fight.world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", cast.id);
    return `cast ${cast.name}`;
}

function runCombat(fight: Fight): string {
    const state = fight.world.state;
    fight.isInCombat = !fight.isInCombat;
    state.isInCombat = fight.isInCombat;
    state.areCooldownsHidden = fight.isInCombat;
    fight.usedInFight.clear();
    fight.unsureInFight.clear();
    for (const known of COOLDOWNS) forgetShown(fight, known.id);
    if (fight.isInCombat) {
        // Running ones from any page; with the choice on, the ready ones a button shows too, not those of a page not shown
        const shown = listShownSpells(fight);
        for (const known of COOLDOWNS) {
            const start = readFightStart(fight, known.id);
            const isReadyShown = fight.isFightStartOn && start === "ready" && shown.has(known.id);
            if (start === "running" || isReadyShown) fight.usedInFight.add(known.id);
            if (start === "unsure") fight.unsureInFight.add(known.id);
        }
        fight.world.fire("PLAYER_REGEN_DISABLED");
        return "fight starts";
    }
    fight.world.fire("PLAYER_REGEN_ENABLED");
    return "fight ends";
}

/** A change of what Dominos pages by: the page follows, at once or a moment later. */
function runPageChange(fight: Fight, kind: string, pick: (count: number) => number, isDelayed: boolean): string {
    const state = fight.world.state;
    let text: string;
    if (kind === "stance") {
        fight.stance = (fight.stance + 1 + pick(2)) % STANCES.length;
        state.activeStance = STANCES[fight.stance]!.id;
        fight.world.fire("UPDATE_SHAPESHIFT_FORM");
        text = STANCES[fight.stance]!.name;
    } else if (kind === "shift") {
        fight.isShiftHeld = !fight.isShiftHeld;
        fight.world.fire("MODIFIER_STATE_CHANGED", "LSHIFT", fight.isShiftHeld ? 1 : 0);
        text = fight.isShiftHeld ? "Shift down" : "Shift up";
    } else {
        fight.isEnemyTargeted = !fight.isEnemyTargeted;
        if (fight.isEnemyTargeted) targetEnemy(state);
        else state.target = undefined;
        fight.world.fire("PLAYER_TARGET_CHANGED");
        text = fight.isEnemyTargeted ? "enemy targeted" : "target cleared";
    }
    if (isDelayed) runTime(fight, PAGE_DELAY);
    applyPage(fight);
    return text;
}

function runStep(fight: Fight, pick: (count: number) => number, isDelayed: boolean): string {
    const kind = STEP_KINDS[pick(STEP_KINDS.length)]!;
    if (kind === "cast") return runCast(fight, pick);
    if (kind === "combat") return runCombat(fight);
    if (kind === "wait") {
        const seconds = 0.5 + pick(80) / 10;
        runTime(fight, seconds);
        return `wait ${seconds}s`;
    }
    return runPageChange(fight, kind, pick, isDelayed);
}

/** What is wrong on the Dominos buttons now; empty when each glows as the truth says. */
function findWrongButtons(fight: Fight): string[] {
    const wrong: string[] = [];
    for (const name of DOMINOS_BUTTONS) {
        const button = fight.world.findFrame((frame) => frame.name === name);
        const spellId = button !== undefined ? readSlotSpell(fight.world.state, button.action) : undefined;
        const want = spellId !== undefined ? isGlowExpected(fight, spellId) : false;
        if (want === undefined) continue;
        const got = fight.world.glowsOnFrame(name) > 0;
        if (got !== want) {
            const spellName = COOLDOWNS.find((known) => known.id === spellId)?.name ?? "nothing";
            wrong.push(`${name} shows ${spellName}: glow ${tostring(got)}, want ${tostring(want)}`);
        }
    }
    return wrong;
}

/** One sequence: its first failure, with the steps that led to it, or undefined. */
function runSequence(seed: number): string | undefined {
    const pick = createRandom(seed);
    const isDelayed = seed % 2 === 0;
    const glowTime = math.floor(seed / 2) % 2 === 0 ? 0 : 3;
    const isFightStartOn = math.floor(seed / 4) % 2 === 1;
    const fight = createFight(
        COOLDOWNS.map(() => (pick(2) === 0 ? 0 : 1 + pick(30))),
        glowTime,
        isFightStartOn,
    );
    const steps = [runCombat(fight)];
    for (let step = 0; step < STEPS; step++) {
        runTime(fight, SETTLE);
        const wrong = findWrongButtons(fight);
        const tags = `${isDelayed ? ", paged late" : ""}${glowTime > 0 ? ", glow 3 s" : ""}${isFightStartOn ? ", combat + start" : ""}`;
        if (wrong.length > 0) return `seed ${seed}${tags}: ${steps.join(", ")} -> ${wrong.join("; ")}`;
        steps.push(runStep(fight, pick, isDelayed));
    }
    return undefined;
}

describe("a warrior with Dominos in random fights (issue #72)", () => {
    it("glows a ready cooldown on a button only while it shows it, and only once it was used in the fight", () => {
        const failures: string[] = [];
        for (let seed = 1; seed <= SEQUENCES; seed++) {
            const failure = runSequence(seed);
            if (failure !== undefined) failures.push(failure);
        }
        const falseGlows = failures.filter((f) => f.includes("glow true"));
        expect(`${failures.length} wrong, ${falseGlows.length} false: ${failures.slice(0, 3).join(" | ")}`).toBe("0 wrong, 0 false: ");
    });
});

/** The warrior goes into a stance: Dominos shows its page. */
function applyStance(fight: Fight, index: number): void {
    fight.stance = index;
    fight.world.state.activeStance = STANCES[index]!.id;
    fight.world.fire("UPDATE_SHAPESHIFT_FORM");
    applyPage(fight);
}

/** A fight with Shield Wall (on the Defensive page's first button) running for 4 more seconds, each glow 3 seconds long. */
function createShieldWallFight(): Fight {
    const fight = createFight([0, 0, 0, 4, 0, 0, 0], 3);
    runCombat(fight);
    return fight;
}

describe("a ready cooldown with a glow time, on a page that comes and goes (issue #72)", () => {
    it("does not glow again when its page comes back, once it glowed its time", () => {
        const fight = createShieldWallFight();
        applyStance(fight, 1);
        runTime(fight, 5);
        expect(fight.world.glowsOnFrame(DOMINOS_BUTTONS[0]!)).toBe(1);
        runTime(fight, 3);
        expect(fight.world.glowsOnFrame(DOMINOS_BUTTONS[0]!)).toBe(0);
        // Battle Stance and back: the stance dance of a tank
        applyStance(fight, 0);
        runTime(fight, 1);
        applyStance(fight, 1);
        runTime(fight, 1);
        expect(fight.world.glowsOnFrame(DOMINOS_BUTTONS[0]!)).toBe(0);
    });

    it("glows its time the first time its page shows, when it came back while the page was not shown", () => {
        const fight = createShieldWallFight();
        runTime(fight, 6);
        applyStance(fight, 1);
        runTime(fight, 1);
        expect(fight.world.glowsOnFrame(DOMINOS_BUTTONS[0]!)).toBe(1);
        runTime(fight, 3);
        expect(fight.world.glowsOnFrame(DOMINOS_BUTTONS[0]!)).toBe(0);
    });
});
