import { createWorld, describe, expect, FORTITUDE, it, learnSpell, playAs, PRIEST, type FakeFrame, type World } from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

/** The Animation button of the Missing buff row, and the list it opens. */
function openAnimationList(): { world: World; button: FakeFrame; list: () => FakeFrame } {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        learnSpell(state, FORTITUDE);
    });
    world.advance(1);
    toggleTable();
    const row = findLabel(world, "Missing buff")!.parent;
    const button = world.frames.find((frame) => frame.parent === row && frame.frameType === "Button" && frame.width === 124)!;
    world.openMenu(button);
    return { world, button, list: () => world.frames.find((frame) => frame.anchor === button)! };
}

describe("a dropdown list of the addon's own (not the game's menu, which taints the gamepad's controls)", () => {
    it("closes on a second click of its button", () => {
        const { button, list } = openAnimationList();
        expect(list().isShown).toBe(true);
        button.scripts.OnClick!(button);
        expect(list().isShown).toBe(false);
    });

    it("closes when a choice is picked, and picks it", () => {
        const { world, button, list } = openAnimationList();
        world.pickFromMenu(button, "Breathing (classic)");
        expect(list().isShown).toBe(false);
        expect((world.getSavedSettings()?.styles as Record<string, Record<string, unknown>>).missingBuff?.animation).toBe(
            "breathingClassic",
        );
    });

    it("closes with the window", () => {
        const { button, list } = openAnimationList();
        // The game hides a window's buttons with it; the fake game does not pass a hide down, so the button is hidden by hand
        button.Show();
        button.Hide();
        expect(list().isShown).toBe(false);
    });
});
