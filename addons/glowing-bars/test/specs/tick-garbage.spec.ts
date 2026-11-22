// What a tick throws away: the game's cleanup frees it, but the more there is, the higher the addon's memory climbs before
// it does. The limits are measured with the test kit's own garbage in (its fake game makes a table for each answer, about
// 2 KB a tick); a cache that stops working, or a new table made on every tick, goes over them.
import { createWorld, describe, expect, FORTITUDE, it, learnSpell, playAs, PRIEST, type World } from "@wowkit/test-kit";
import { setUpWarrior } from "./table.helpers";

/**
 * The KB a tick of half a second throws away: the least of three runs of 40 ticks, with the cleanup held, after a warm-up.
 * The least, as the first time a text or a table is made costs once, by what the tests before happened to make.
 */
function measureGarbagePerTick(world: World): number {
    world.advance(20);
    let least = math.huge;
    for (let run = 0; run < 3; run++) {
        collectgarbage("collect");
        collectgarbage("stop");
        const before = collectgarbage("count");
        world.advance(20);
        const after = collectgarbage("count");
        collectgarbage("restart");
        least = math.min(least, (after - before) / 40);
    }
    return least;
}

describe("the garbage of a tick", () => {
    it("stays small for a warrior in a fight, with a cooldown to watch", () => {
        const world = createWorld((state) => setUpWarrior(state));
        expect(measureGarbagePerTick(world) < 4.5).toBe(true);
    });

    it("stays small for a priest with a buff missing", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
        });
        expect(measureGarbagePerTick(world) < 6.3).toBe(true);
    });
});

describe("the garbage of a tick, with buffs up", () => {
    /** Ten buffs the player added, all up: what is seen of each, each tick. */
    const BUFFS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: 1297800 + n, name: `Buff ${n}`, rank: 1, icon: 1, isHelpful: true }));

    it("stays small for a priest with ten buffs up", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                BUFFS.forEach((buff, index) => {
                    learnSpell(state, buff);
                    state.bars[index + 1] = buff.id;
                });
            },
            { addedSpells: BUFFS.map((buff) => ({ id: buff.id, reminderType: "missingBuff" as const })) },
        );
        for (const buff of BUFFS) world.state.auras.push(world.makeAura(buff.name, buff.id, 99999, "player"));
        expect(measureGarbagePerTick(world) < 30).toBe(true);
    });
});
