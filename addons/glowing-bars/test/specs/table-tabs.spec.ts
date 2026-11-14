// The tabs of the table of looks: each lists its types (Buffs, Cooldowns, Procs, Consumables, Old ranks), and the sounds of
// the player's own have one too. A tab with nothing on it and nothing to add is left out; the table opens on the tab it was on.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    PALADIN,
    PRIEST,
    SMITE_RANK_1,
    SMITE_RANK_2,
    type World,
} from "@wowkit/test-kit";
import {
    findLabelOnTab,
    setUpWarrior,
    showTab,
    showUnlearned,
    toggleTable,
    useAndRecoverRecklessness,
    switchInTable,
} from "./table.helpers";

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

describe("the spells not learned yet in the table", () => {
    /** A warrior who knows the name of Overpower (a proc) and of Battle Shout (a buff of the class), and learned neither. */
    function openWarriorKnowingNames(): World {
        const world = createWorld((state) => {
            setUpWarrior(state);
            state.spells[7384] = { id: 7384, name: "Overpower", rank: 1, icon: 132223 };
            state.spells[6673] = { id: 6673, name: "Battle Shout", rank: 1, icon: 132333 };
        });
        world.advance(1);
        toggleTable();
        return world;
    }

    const findSwitch = (world: World) =>
        world.frames.find(
            (frame) =>
                frame.frameType === "CheckButton" &&
                frame.isShown &&
                frame.parent?.isShown === true &&
                frame.fontStrings.some((text) => text.text === "Show unlearned spells"),
        );

    it("are left out by default, and listed faded once the tab's switch is on", () => {
        const world = openWarriorKnowingNames();
        showTab(world, "Procs");
        expect(findLabelOnTab(world, "Overpower")).toBeUndefined();
        showUnlearned(world, "Procs");
        expect(findLabelOnTab(world, "Overpower")!.alpha).toBe(0.5);
        toggleTable();
    });

    it("are switched on for one tab at a time, kept for the next opening", () => {
        const world = openWarriorKnowingNames();
        showUnlearned(world, "Procs");
        showTab(world, "Buffs");
        expect(findLabelOnTab(world, "Battle Shout")).toBeUndefined();
        toggleTable();
        toggleTable();
        showTab(world, "Procs");
        expect(findLabelOnTab(world, "Overpower")).toBeDefined();
        const shown = world.getSavedSettings()?.shownUnlearned as Record<string, boolean | undefined>;
        expect(shown.procs).toBe(true);
        expect(shown.buffs).toBe(undefined);
        toggleTable();
    });

    it("have no switch on a tab with none", () => {
        const world = openWarriorKnowingNames();
        showTab(world, "Procs");
        expect(findSwitch(world)).toBeDefined();
        showTab(world, "Consumables");
        expect(findSwitch(world)).toBeUndefined();
        toggleTable();
    });
});

describe("the rows of a reagent in the table", () => {
    const KINGS = { id: 25898, name: "Greater Blessing of Kings", rank: 1, icon: 135993, isHelpful: true };
    const WISDOM = { id: 25894, name: "Greater Blessing of Wisdom", rank: 1, icon: 135912, isHelpful: true };
    const SYMBOL_OF_KINGS = 21177;

    /** A paladin with Greater Blessing of Kings and of Wisdom on buttons 1 and 2, five Symbols of Kings, the table open. */
    function openPaladin(): World {
        const world = createWorld((state) => {
            playAs(state, PALADIN);
            state.spells[25782] = { id: 25782, name: "Greater Blessing of Might", rank: 1, icon: 135908 };
            for (const spell of [KINGS, WISDOM]) {
                learnSpell(state, spell);
                state.reagentTexts[spell.id] = "Symbol of Kings";
            }
            state.bars[1] = KINGS.id;
            state.bars[2] = WISDOM.id;
            state.bags[SYMBOL_OF_KINGS] = 5;
        });
        world.advance(1);
        toggleTable();
        showTab(world, "Consumables");
        return world;
    }

    it("has one for each spell that takes it, the reagent first", () => {
        const world = openPaladin();
        expect(findLabelOnTab(world, "Symbol of Kings (Greater Blessing of Kings)")!.alpha).toBe(1);
        expect(findLabelOnTab(world, "Symbol of Kings (Greater Blessing of Wisdom)")).toBeDefined();
        // Not learned: left out, like any spell of the lists not learned yet
        expect(findLabelOnTab(world, "Symbol of Kings (Greater Blessing of Might)")).toBeUndefined();
        showUnlearned(world, "Consumables");
        expect(findLabelOnTab(world, "Symbol of Kings (Greater Blessing of Might)")!.alpha).toBe(0.5);
        toggleTable();
    });

    it("keeps a limit and a switch of each row's own: the other spells of the reagent go on glowing", () => {
        const world = openPaladin();
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
        const kingsRow = findLabelOnTab(world, "Symbol of Kings (Greater Blessing of Kings)")!.parent;
        const below = world.frames.filter((frame) => frame.parent === kingsRow && frame.frameType === "EditBox" && frame.text === "10")[0]!;
        below.text = "3";
        below.scripts.OnEditFocusLost!(below);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
        switchInTable(world, "Symbol of Kings (Greater Blessing of Wisdom)", false);
        world.advance(1);
        expect(world.glowsOn(2)).toBe(0);
        toggleTable();
    });
});
