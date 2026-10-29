import { createWorld, describe, expect, it, learnSpell, playAs, FORTITUDE, PRIEST } from "@wowkit/test-kit";

describe("a priest who plays with DaylightUI", () => {
    /** DaylightUI's bar 2 is Action Bar 2: slots 61 to 72. */
    const DAYLIGHT_BAR_2_FIRST = 61;

    function setUp(state: Parameters<Parameters<typeof createWorld>[0]>[0]): void {
        playAs(state, PRIEST);
        learnSpell(state, FORTITUDE);
        state.hasDaylight = true;
        state.bars[DAYLIGHT_BAR_2_FIRST] = FORTITUDE.id;
    }

    it("sees the missing buff glow on DaylightUI's button", () => {
        const world = createWorld(setUp);
        world.advance(1);
        expect(world.glowsOnFrame("DaylightUIBar2Button1")).toBe(1);
    });

    it("sees no glow there once Action Bar 2 is switched off: DaylightUI's bar 2 is it", () => {
        const world = createWorld(setUp, { barOff: { "2": true } });
        world.advance(1);
        expect(world.glowsOnFrame("DaylightUIBar2Button1")).toBe(0);
    });

    it("fades DaylightUI's bar 2 with Action Bar 2", () => {
        const world = createWorld(setUp, { barFaded: { "2": true } });
        world.advance(1);
        expect(world.findFrame((frame) => frame.name === "DaylightUIBar2Button2")!.alpha).toBe(0.5);
    });
});
