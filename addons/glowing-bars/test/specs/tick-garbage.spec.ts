// What a tick throws away: the game's cleanup frees it, but the more there is, the higher the addon's memory climbs before
// it does. The limits are measured with the test kit's own garbage in (its fake game makes a table for each answer, about
// 2 KB a tick); a cache that stops working, or a new table made on every tick, goes over them.
import { createWorld, describe, expect, FORTITUDE, it, learnSpell, playAs, PRIEST, type World } from "@wowkit/test-kit";
import { setUpWarrior } from "./table.helpers";

/** The KB a tick of half a second throws away, on average over 100 ticks, with the cleanup held. */
function measureGarbagePerTick(world: World): number {
    world.advance(5);
    collectgarbage("collect");
    collectgarbage("stop");
    const before = collectgarbage("count");
    world.advance(50);
    const after = collectgarbage("count");
    collectgarbage("restart");
    return (after - before) / 100;
}

describe("the garbage of a tick", () => {
    it("stays small for a warrior in a fight, with a cooldown to watch", () => {
        const world = createWorld((state) => setUpWarrior(state));
        expect(measureGarbagePerTick(world) < 4.2).toBe(true);
    });

    it("stays small for a priest with a buff missing", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
        });
        expect(measureGarbagePerTick(world) < 6).toBe(true);
    });
});
