import { beforeEach, createWorld, describe, expect, it, learnSpell, playAs, FORTITUDE, PRIEST, type World } from "@wowkit/test-kit";

/** Action Bar 7 starts at this action slot. */
const BAR_7_FIRST_SLOT = 157;

describe("a priest with Fortitude on Action Bar 1 and on Action Bar 7", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
            state.bars[BAR_7_FIRST_SLOT] = FORTITUDE.id;
        });
        world.advance(1);
    });

    it("sees the missing buff glow on both bars", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(1, "MultiBar6")).toBe(1);
    });

    it("sees it only on Action Bar 7 once Action Bar 1 is switched off", () => {
        world.setOption("bar_1", false);
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(1, "MultiBar6")).toBe(1);
    });

    it("keeps the switch only where the player changed it", () => {
        world.setOption("bar_1", false);
        world.setOption("bar_1", true);
        const barOff = world.getSavedSettings()?.barOff as Record<string, boolean | undefined>;
        expect(barOff["1"]).toBeUndefined();
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});
