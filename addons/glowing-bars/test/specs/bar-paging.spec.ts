// A bar addon can page its bars with no event of the game's (Dominos by a modifier key or by the target): the button then
// shows another slot, and the glows follow it.
import { createWorld, describe, expect, FORTITUDE, it, learnSpell, playAs, PRIEST } from "@wowkit/test-kit";

/** Dominos's button 13 shows slot 13; while Shift is held, a page whose slot is this one. */
const OWN_SLOT = 13;
const SHIFT_PAGE_SLOT = 73;

describe("a button Dominos pages with no event of the game's", () => {
    it("shows the glow of what it shows, by Shift or the target, in a fight too", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.hasDominos = true;
            state.bars[SHIFT_PAGE_SLOT] = FORTITUDE.id;
        });
        world.advance(1);
        world.state.isInCombat = true;
        const button = world.findFrame((frame) => frame.name === "DominosActionButton13")!;
        expect(world.glowsOnFrame("DominosActionButton13")).toBe(0);
        // Shift held: the button shows the other page's slot, and the buff missing there glows on it
        button.action = SHIFT_PAGE_SLOT;
        world.advance(1);
        expect(world.glowsOnFrame("DominosActionButton13")).toBe(1);
        // Let go: its own slot again, empty
        button.action = OWN_SLOT;
        world.advance(1);
        expect(world.glowsOnFrame("DominosActionButton13")).toBe(0);
    });
});
