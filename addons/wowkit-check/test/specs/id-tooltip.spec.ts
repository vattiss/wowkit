import { beforeEach, createWorld, describe, expect, it, FORTITUDE, type World } from "@wowkit/test-kit";

/** An elixir of the fake game: item 13452 casts the spell 17538 when it is used. */
const ELIXIR_ITEM = 13452;
const ELIXIR_SPELL = 17538;

describe("the IDs in the tooltips", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            state.itemUseSpells[ELIXIR_ITEM] = ELIXIR_SPELL;
        });
    });

    it("adds the ID to the tooltip of a spell", () => {
        expect(world.tooltipLines("spell", FORTITUDE.id)).toEqual([`Spell ID: ${FORTITUDE.id}`]);
    });

    it("adds the spell an item casts to the tooltip of the item", () => {
        expect(world.tooltipLines("item", ELIXIR_ITEM)).toEqual([`Use spell ID: ${ELIXIR_SPELL}`]);
    });

    it("adds nothing to the tooltip of an item that is not used", () => {
        expect(world.tooltipLines("item", 17028)).toEqual([]);
    });

    it("adds nothing when the tooltip has no ID", () => {
        expect(world.tooltipLines("spell", undefined)).toEqual([]);
        expect(world.tooltipLines("item", undefined)).toEqual([]);
    });
});
