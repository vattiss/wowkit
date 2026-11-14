// The tabs of the table of looks: each lists its types (Buffs, Cooldowns, Procs, Consumables, Old ranks), and the sounds of
// the player's own have one too. A tab with nothing on it and nothing to add is left out; the table opens on the tab it was on.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, SMITE_RANK_1, SMITE_RANK_2, type World } from "@wowkit/test-kit";
import { findLabelOnTab, setUpWarrior, showTab, toggleTable, useAndRecoverRecklessness } from "./table.helpers";

function openWarrior(saved?: Record<string, unknown>): World {
    const world = createWorld(setUpWarrior, saved);
    world.advance(1);
    useAndRecoverRecklessness(world);
    toggleTable();
    return world;
}

const isTabShown = (world: World, label: string) =>
    world.frames.some((frame) => frame.frameType === "Button" && frame.text === label && frame.isShown);

describe("the tabs of the table", () => {
    it("list each type on its own tab, and the sounds on theirs", () => {
        const world = openWarrior();
        showTab(world, "Buffs");
        expect(findLabelOnTab(world, "Missing buff")).toBeDefined();
        expect(findLabelOnTab(world, "Ready cooldown")).toBeUndefined();
        showTab(world, "Cooldowns");
        expect(findLabelOnTab(world, "Ready cooldown")).toBeDefined();
        expect(findLabelOnTab(world, "Recklessness")).toBeDefined();
        expect(findLabelOnTab(world, "Proc")).toBeUndefined();
        showTab(world, "Procs");
        expect(findLabelOnTab(world, "Proc")).toBeDefined();
        showTab(world, "Sounds");
        expect(findLabelOnTab(world, "Custom Sounds")).toBeDefined();
        expect(findLabelOnTab(world, "Recklessness")).toBeUndefined();
        toggleTable();
    });

    it("leave out Old ranks with no spell of ranks, and offer the tabs a spell can be added to", () => {
        const world = openWarrior();
        expect(isTabShown(world, "Old ranks")).toBe(false);
        // A warrior has no reagent and watches no item, but can add one
        expect(isTabShown(world, "Consumables")).toBe(true);
        // Only the add row then: no header over an empty list
        showTab(world, "Consumables");
        expect(findLabelOnTab(world, "Defaults")).toBeUndefined();
        expect(findLabelOnTab(world, "Add Spell/Item by ID")).toBeDefined();
        toggleTable();
        const priest = createWorld((state) => {
            playAs(state, PRIEST);
            for (const spell of [SMITE_RANK_1, SMITE_RANK_2]) learnSpell(state, spell);
            state.bars[1] = SMITE_RANK_1.id;
        });
        priest.advance(1);
        toggleTable();
        expect(isTabShown(priest, "Old ranks")).toBe(true);
        toggleTable();
    });

    it("open on the tab they were on, and on the first when that one is not offered", () => {
        const world = openWarrior();
        showTab(world, "Procs");
        toggleTable();
        toggleTable();
        expect(findLabelOnTab(world, "Proc")).toBeDefined();
        expect(world.getSavedSettings()?.tableTab).toBe("procs");
        toggleTable();
        const noRanks = openWarrior({ tableTab: "oldRanks" });
        expect(findLabelOnTab(noRanks, "Missing buff")).toBeDefined();
        toggleTable();
    });

    it("hide the column headers on the tab of the sounds", () => {
        const world = openWarrior();
        const window = world.findFrame((frame) => frame.name === "GlowingBarsLooks")!;
        const isColorShown = () => window.fontStrings.some((text) => text.text === "Color" && text.isShown !== false);
        showTab(world, "Cooldowns");
        expect(isColorShown()).toBe(true);
        showTab(world, "Sounds");
        expect(isColorShown()).toBe(false);
        toggleTable();
    });

    it("take the sounds' folders off the screen on another tab", () => {
        const world = openWarrior();
        showTab(world, "Sounds");
        const onScreen = () =>
            world.frames.filter(
                (frame) =>
                    frame.isShown &&
                    frame.parent?.isShown === true &&
                    ((frame.frameType === "EditBox" && frame.width === 200) || frame.text === "Add folder"),
            ).length;
        expect(onScreen()).toBe(2);
        showTab(world, "Cooldowns");
        expect(onScreen()).toBe(0);
        showTab(world, "Sounds");
        expect(onScreen()).toBe(2);
        toggleTable();
    });
});
