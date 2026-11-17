// A mage's teleport added as a low reagent, Below 1 (issue #81): its reagent, Rune of Teleportation, is known by the name
// its tooltip gives, and counted in the bags by that name.
import { createWorld, describe, expect, it, learnSpell, playAs, type CharacterClass, type World } from "@wowkit/test-kit";

const MAGE: CharacterClass = { name: "Mage", token: "MAGE", id: 8 };
const TELEPORT_UNDERCITY = { id: 3563, name: "Teleport: Undercity", rank: 1, icon: 135766, isHelpful: true };
const RUNE_OF_TELEPORTATION = 17031;

/** A mage in a town with Teleport: Undercity on button 1, added as a low reagent below 1, and this many runes. */
function createMage(runes: number): World {
    const world = createWorld(
        (state) => {
            playAs(state, MAGE);
            learnSpell(state, TELEPORT_UNDERCITY);
            state.bars[1] = TELEPORT_UNDERCITY.id;
            state.reagentTexts[TELEPORT_UNDERCITY.id] = "Rune of Teleportation";
            state.itemNames[RUNE_OF_TELEPORTATION] = "Rune of Teleportation";
            state.bags[RUNE_OF_TELEPORTATION] = runes;
            state.isResting = true;
        },
        {
            addedSpells: [{ id: TELEPORT_UNDERCITY.id, reminderType: "lowReagent" }],
            belowLimits: { [`lowReagent:spell${TELEPORT_UNDERCITY.id}`]: 1 },
        },
    );
    world.advance(1);
    return world;
}

describe("a mage's teleport with its rune below 1 (issue #81)", () => {
    it("stays dark with a rune in the bags", () => {
        expect(createMage(1).glowsOn(1)).toBe(0);
    });

    it("glows with no rune left, and goes dark once one is bought", () => {
        const world = createMage(0);
        expect(world.glowsOn(1)).toBe(1);
        world.state.bags[RUNE_OF_TELEPORTATION] = 1;
        world.fire("BAG_UPDATE_DELAYED");
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("glows again once the last rune is used", () => {
        const world = createMage(1);
        world.state.bags[RUNE_OF_TELEPORTATION] = 0;
        world.fire("BAG_UPDATE_DELAYED");
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});
