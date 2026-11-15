// What the addon keeps between ticks (the looks, the buttons of a spell, the windows of the Cooldown Manager, the names and
// IDs of the spells) is let go as soon as what it was worked out from changes: a change made while a glow is lit shows at
// the next tick, not at the next login.
import {
    createWorld,
    describe,
    expect,
    FORTITUDE,
    INNER_FIRE,
    it,
    learnSpell,
    playAs,
    PRIEST,
    type FakeFrame,
    type World,
} from "@wowkit/test-kit";
import { findRow, toggleTable } from "./table.helpers";

/** A priest with Fortitude on button 1 and no Fortitude up: it glows. */
function createGlowingPriest(isLearned = true): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        if (isLearned) learnSpell(state, FORTITUDE);
        else state.spells[FORTITUDE.id] = FORTITUDE;
        state.bars[1] = FORTITUDE.id;
    });
    world.advance(1);
    return world;
}

describe("a change while a glow is lit", () => {
    it("of the look shows at the next tick", () => {
        const world = createGlowingPriest();
        expect(world.glowAlphasOn(1)).toEqual([1]);
        toggleTable();
        const percent = findRow(world, "Missing buff").glowPercent;
        percent.text = "40";
        percent.scripts.OnEditFocusLost!(percent);
        world.advance(1);
        expect(world.glowAlphasOn(1)).toEqual([0.4]);
    });

    it("of the button the spell is on moves the glow", () => {
        const world = createGlowingPriest();
        expect(world.glowsOn(1)).toBe(1);
        world.state.bars[1] = undefined;
        world.state.bars[2] = FORTITUDE.id;
        world.fire("ACTIONBAR_SLOT_CHANGED", 1);
        world.fire("ACTIONBAR_SLOT_CHANGED", 2);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("of the spells learned lights a spell learned just now", () => {
        const world = createGlowingPriest(false);
        expect(world.glowsOn(1)).toBe(0);
        learnSpell(world.state, FORTITUDE);
        world.fire("LEARNED_SPELL_IN_SKILL_LINE", FORTITUDE.id);
        world.advance(2);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("of the windows of the Cooldown Manager takes the glow off a window turned off", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.bars[1] = INNER_FIRE.id;
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false, isBar: true });
            },
            { isCooldownManagerSetUp: true, isTrackedBarsSplit: true, trackedBarsIcons: "show", barsThatGlow: { trackedBars: true } },
        );
        world.advance(3);
        const countBesideIcons = () =>
            world.frames.filter(
                (frame) =>
                    frame.parent?.parent === (UIParent as unknown as FakeFrame) &&
                    frame.template === "ActionButtonSpellAlertTemplate" &&
                    frame.isShown,
            ).length;
        expect(countBesideIcons()).toBe(1);
        world.setOption("trackedBarsIcons", "hide");
        world.advance(3);
        expect(countBesideIcons()).toBe(0);
    });
});
