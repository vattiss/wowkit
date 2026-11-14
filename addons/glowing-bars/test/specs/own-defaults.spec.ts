// A spell with a default of its own (Shield Block: only in combat) follows what the player sets for its type all the same:
// no spell keeps a default hidden from the type's row. It then shows it is changed, and its Reset gives its own default
// back, until the type is changed again; then it follows the type once more.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    WARRIOR,
    type FakeFrame,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { findLabel, findRow, toggleTable } from "./table.helpers";

const SHIELD_BLOCK: SpellDefinition = { id: 2565, name: "Shield Block", rank: 1, icon: 132110, isHelpful: true, cooldownSeconds: 5 };
const WHEN_LABELS = ["Always", "In combat", "Out of combat", "Enemy targeted", "Ally targeted", "Any targeted"];

/** A warrior with Shield Block added as a missing buff, the table open. */
function openTable(): World {
    const world = createWorld(
        (state) => {
            playAs(state, WARRIOR);
            learnSpell(state, SHIELD_BLOCK);
            state.bars[1] = SHIELD_BLOCK.id;
        },
        { addedSpells: [{ id: SHIELD_BLOCK.id, reminderType: "missingBuff" }] },
    );
    world.advance(1);
    toggleTable();
    return world;
}

/** The When button of the row with this label. */
function findWhenButton(world: World, label: string): FakeFrame {
    const row = findLabel(world, label)?.parent;
    if (row === undefined) throw new Error(`no row for ${label}`);
    return world.frames.find((frame) => frame.parent === row && frame.frameType === "Button" && WHEN_LABELS.includes(frame.text ?? ""))!;
}

describe("a spell with a default of its own, and its type changed", () => {
    it("has its own default, unchanged, until the type is changed", () => {
        const world = openTable();
        expect(findWhenButton(world, "Shield Block").text).toBe("In combat");
        expect(findRow(world, "Shield Block").reset.isShown).toBe(false);
        toggleTable();
    });

    it("follows the type, shows it is changed, and its Reset gives its own default back", () => {
        const world = openTable();
        world.pickFromMenu(findWhenButton(world, "Missing buff"), "Always");
        expect(findWhenButton(world, "Shield Block").text).toBe("Always");
        const row = findRow(world, "Shield Block");
        expect(row.reset.isShown).toBe(true);
        row.reset.scripts.OnClick!(row.reset);
        expect(findWhenButton(world, "Shield Block").text).toBe("In combat");
        expect(findRow(world, "Shield Block").reset.isShown).toBe(false);
        toggleTable();
    });

    it("follows the type again once the type is changed again after its Reset", () => {
        const world = openTable();
        world.pickFromMenu(findWhenButton(world, "Missing buff"), "Always");
        const row = findRow(world, "Shield Block");
        row.reset.scripts.OnClick!(row.reset);
        world.pickFromMenu(findWhenButton(world, "Missing buff"), "Out of combat");
        expect(findWhenButton(world, "Shield Block").text).toBe("Out of combat");
        expect(findRow(world, "Shield Block").reset.isShown).toBe(true);
        toggleTable();
    });

    it("keeps what the player chose for the spell itself when the type changes", () => {
        const world = openTable();
        world.pickFromMenu(findWhenButton(world, "Shield Block"), "Enemy targeted");
        world.pickFromMenu(findWhenButton(world, "Missing buff"), "Out of combat");
        expect(findWhenButton(world, "Shield Block").text).toBe("Enemy targeted");
        toggleTable();
    });

    it("has its own default again when the type is reset", () => {
        const world = openTable();
        world.pickFromMenu(findWhenButton(world, "Missing buff"), "Always");
        const typeRow = findRow(world, "Missing buff");
        expect(typeRow.reset.isShown).toBe(true);
        typeRow.reset.scripts.OnClick!(typeRow.reset);
        expect(findWhenButton(world, "Shield Block").text).toBe("In combat");
        expect(findRow(world, "Shield Block").reset.isShown).toBe(false);
        toggleTable();
    });
});
