// A spell learned at a trainer while the table is open: its row comes up without opening the table again, but not under
// the player's typing. The rows are looked for on the tab shown alone: going to another tab draws the rows anew.
import { beforeEach, createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type FakeFrame, type World } from "@wowkit/test-kit";
import { RECKLESSNESS, findAddRowOf, findLabelOnTab, showTab, toggleTable } from "./table.helpers";

type FocusBox = FakeFrame & { SetFocus(): void; ClearFocus(): void };

describe("the open table, as a spell is learned", () => {
    let world!: World;

    function learnRecklessness(): void {
        learnSpell(world.state, RECKLESSNESS);
        world.state.bars[2] = RECKLESSNESS.id;
        world.fire("LEARNED_SPELL_IN_SKILL_LINE", RECKLESSNESS.id);
    }

    beforeEach(() => {
        world = createWorld((state) => playAs(state, WARRIOR));
        world.advance(1);
        toggleTable();
        showTab(world, "Cooldowns");
    });

    it("shows the new spell's row once it is learned", () => {
        expect(findLabelOnTab(world, "Recklessness")).toBeUndefined();
        learnRecklessness();
        world.advance(1);
        expect(findLabelOnTab(world, "Recklessness")).toBeDefined();
    });

    it("waits while the player types in a box, and shows it once the box is left", () => {
        const box = findAddRowOf(world).box as FocusBox;
        box.SetFocus();
        learnRecklessness();
        world.advance(3);
        expect(findLabelOnTab(world, "Recklessness") === undefined).toBe(true);
        box.ClearFocus();
        world.advance(1.5);
        expect(findLabelOnTab(world, "Recklessness")).toBeDefined();
    });
});
