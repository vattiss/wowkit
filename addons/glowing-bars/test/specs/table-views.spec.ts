import { createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type FakeFrame, type World } from "@wowkit/test-kit";
import { recoverCooldown } from "./cooldown.helpers";
import { RECKLESSNESS, findLabel, setUpWarrior, showTab, toggleTable } from "./table.helpers";

const ADVANCED_ONLY = ["Spell / Item ID", "Glow %", "Repeat", "When", "Glow time", "Animation"];
const BOTH = ["Spell / Item", "Type", "Color", "Message", "Sound", "Enabled", "Actions"];

function createOpenTable(savedSettings: Record<string, unknown> = {}): World {
    const world = createWorld((state) => {
        setUpWarrior(state);
        playAs(state, WARRIOR);
        learnSpell(state, RECKLESSNESS);
    }, savedSettings);
    world.advance(1);
    toggleTable();
    return world;
}

function findWindow(world: World): FakeFrame {
    return world.findFrame((frame) => frame.name === "GlowingBarsLooks")!;
}

function isHeaderShown(world: World, text: string): boolean {
    const header = findWindow(world).fontStrings.find((other) => other.text === text);
    return header !== undefined && header.isShown !== false;
}

function findViewButton(world: World, text: string): FakeFrame {
    const button = world.frames.find((frame) => frame.parent === findWindow(world) && frame.text === text);
    if (button === undefined) throw new Error(`no ${text} button`);
    return button;
}

/** The controls of a row that are shown, by their frame types. */
function listShown(world: World, label: string, frameType: string): FakeFrame[] {
    const row = findLabel(world, label)!.parent;
    return world.frames.filter((frame) => frame.parent === row && frame.frameType === frameType && frame.isShown);
}

describe("the views of the table", () => {
    it("starts in Basic, with the columns everybody needs", () => {
        const world = createOpenTable();
        for (const text of BOTH) expect(isHeaderShown(world, text)).toBe(true);
        for (const text of ADVANCED_ONLY) expect(isHeaderShown(world, text)).toBe(false);
    });

    it("shows every column in Advanced", () => {
        const world = createOpenTable({ isTableAdvanced: true });
        for (const text of [...BOTH, ...ADVANCED_ONLY]) expect(isHeaderShown(world, text)).toBe(true);
    });

    it("is much narrower in Basic", () => {
        const basic = findWindow(createOpenTable()).width;
        const advanced = findWindow(createOpenTable({ isTableAdvanced: true })).width;
        expect(basic < advanced * 0.7).toBe(true);
    });

    it("hides the boxes and buttons of the other columns from the rows", () => {
        const basic = createOpenTable();
        expect(listShown(basic, "Recklessness", "EditBox").length).toBe(0);
        const advanced = createOpenTable({ isTableAdvanced: true });
        expect(listShown(advanced, "Recklessness", "EditBox").length).toBe(2);
    });

    it("switches with its button, which is saved and says where it leads", () => {
        const world = createOpenTable();
        const button = findViewButton(world, "Advanced");
        button.scripts.OnClick!(button);
        expect(world.getSavedSettings()?.isTableAdvanced).toBe(true);
        expect(button.text).toBe("Basic");
        expect(isHeaderShown(world, "When")).toBe(true);
        expect(listShown(world, "Recklessness", "EditBox").length).toBe(2);
        button.scripts.OnClick!(button);
        expect(world.getSavedSettings()?.isTableAdvanced).toBe(false);
        expect(button.text).toBe("Advanced");
        expect(isHeaderShown(world, "When")).toBe(false);
    });

    function readHeaderTips(world: World): string[] {
        const window = findWindow(world);
        const hovers = world.frames.filter((frame) => frame.parent === window && frame.frameType === "Frame" && frame.isShown);
        return hovers.map((hover) => {
            hover.scripts.OnEnter?.(hover);
            return world.findFrame((frame) => frame.name === "GameTooltip")?.text ?? "";
        });
    }

    it("explains its columns as the mouse comes over their headers: only the ones of the view", () => {
        const basic = readHeaderTips(createOpenTable());
        const advanced = readHeaderTips(createOpenTable({ isTableAdvanced: true }));
        expect(basic.length).toBe(7);
        expect(advanced.length).toBe(14);
        for (const tips of [basic, advanced]) {
            expect(tips.some((tip) => tip.includes("Reset: undoes your changes on this row."))).toBe(true);
            expect(tips.some((tip) => tip.includes("The sound that plays when the reminder starts."))).toBe(true);
        }
    });

    it("has no tooltip on the controls of a row", () => {
        const world = createOpenTable({ isTableAdvanced: true });
        const row = findLabel(world, "Recklessness")!.parent;
        const controls = world.frames.filter((frame) => frame.parent === row);
        expect(controls.length > 5).toBe(true);
        expect(controls.filter((control) => control.scripts.OnEnter !== undefined).length).toBe(0);
    });

    it("keeps applying what was set in a column that is hidden", () => {
        const world = createOpenTable({ styles: { readyCooldown: { when: "always" } } });
        expect(isHeaderShown(world, "When")).toBe(false);
        world.state.isInCombat = false;
        world.advance(1);
        recoverCooldown(world, 1719);
        expect(world.glowsOn(2)).toBe(1);
    });
});

describe("the Below column", () => {
    const ARROWS = { addedSpells: [{ id: 2512, reminderType: "lowStock" }] };

    it("is left out while no row has a limit, and the Basic window keeps its one size, the settings window's", () => {
        const without = createOpenTable();
        showTab(without, "Consumables");
        const withArrows = createOpenTable(ARROWS);
        showTab(withArrows, "Cooldowns");
        expect(isHeaderShown(withArrows, "Below")).toBe(false);
        showTab(withArrows, "Consumables");
        expect(isHeaderShown(without, "Below")).toBe(false);
        expect(isHeaderShown(withArrows, "Below")).toBe(true);
        expect(findWindow(withArrows).width).toBe(findWindow(without).width);
    });

    it("keeps its place, empty, on a tab with no limit: the names are as wide on every tab", () => {
        // The arrows' tab fills the column, the tab of Recklessness leaves it empty
        const world = createOpenTable(ARROWS);
        const without = findLabel(world, "Recklessness")!;
        const rowWidth = without.parent!.width;
        const nameWidth = without.width;
        // The item has no name in this game: its row goes by its ID
        const withArrows = findLabel(world, "2512")!;
        expect(withArrows.parent!.width).toBe(rowWidth);
        expect(withArrows.width).toBe(nameWidth);
    });

    it("has no header on a tab with no limit in Advanced too, and the window keeps its size", () => {
        const without = createOpenTable({ isTableAdvanced: true });
        showTab(without, "Consumables");
        const withArrows = createOpenTable({ isTableAdvanced: true, ...ARROWS });
        showTab(withArrows, "Consumables");
        expect(isHeaderShown(without, "Below")).toBe(false);
        expect(isHeaderShown(withArrows, "Below")).toBe(true);
        expect(findWindow(withArrows).width).toBe(findWindow(without).width);
    });

    it("goes when the last row with a limit is removed", () => {
        const world = createOpenTable(ARROWS);
        const row = findLabel(world, "Low stock")!.parent;
        expect(row === undefined).toBe(false);
        const arrow = world.frames.find((frame) => frame.template === "UIPanelButtonTemplate" && frame.text === "X" && frame.isShown)!;
        arrow.scripts.OnClick!(arrow);
        expect(isHeaderShown(world, "Below")).toBe(false);
    });
});

describe("the list of spells of the table", () => {
    it("has a small heading above each type it has, and none for the others", () => {
        const world = createOpenTable();
        showTab(world, "Cooldowns");
        const content = world.frames.find((frame) => frame.fontStrings.some((text) => text.text === "Spells (Override the Defaults)"))!;
        const shown = content.fontStrings.filter((text) => text.isShown !== false).map((text) => text.text);
        expect(shown.includes("Ready cooldown")).toBe(true);
        expect(shown.includes("Missing seal")).toBe(false);
    });

    it("has them under the header of the spells, in the order of the types", () => {
        const world = createOpenTable();
        showTab(world, "Cooldowns");
        const content = world.frames.find((frame) => frame.fontStrings.some((text) => text.text === "Spells (Override the Defaults)"))!;
        const texts = content.fontStrings.map((text) => text.text);
        expect(texts.indexOf("Spells (Override the Defaults)") < texts.indexOf("Ready cooldown")).toBe(true);
    });
});

describe("the X of the table", () => {
    it("closes it by itself, also in a fight", () => {
        const world = createOpenTable({});
        world.state.isInCombat = true;
        const window = world.findFrame((frame) => frame.name === "GlowingBarsLooks")!;
        const close = world.frames.find((frame) => frame.parent === window && frame.template === "UIPanelCloseButton")!;
        close.scripts.OnClick!(close);
        expect(window.isShown).toBe(false);
    });
});
