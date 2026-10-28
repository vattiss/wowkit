import { createWorld, describe, expect, it, learnSpell, playAs, type CharacterClass, type World } from "@wowkit/test-kit";

const WARLOCK: CharacterClass = { name: "Warlock", token: "WARLOCK", id: 9 };
const MAIN_HAND = 16;
/** The spell that makes a Firestone, and the Major Firestone with the spell that puts it on the weapon. */
const CREATE_FIRESTONE = { id: 6366, name: "Create Firestone", rank: 1, icon: 132386, isHelpful: true };
const MAJOR_FIRESTONE = { item: 13701, spell: 17949, name: "Major Firestone" };

/** A warlock with an empty weapon, Create Firestone on button 1 and a Major Firestone on button 2 (this many in the bags). */
function createWarlockWorld(stones: number): World {
    const world = createWorld((state) => {
        playAs(state, WARLOCK);
        learnSpell(state, CREATE_FIRESTONE);
        state.bars[1] = CREATE_FIRESTONE.id;
        state.spells[MAJOR_FIRESTONE.spell] = {
            id: MAJOR_FIRESTONE.spell,
            name: MAJOR_FIRESTONE.name,
            rank: 1,
            icon: 132386,
            isHelpful: true,
        };
        state.itemUseSpells[MAJOR_FIRESTONE.item] = MAJOR_FIRESTONE.spell;
        state.barItems[2] = MAJOR_FIRESTONE.item;
        state.bags[MAJOR_FIRESTONE.item] = stones;
        state.equippedItems[MAIN_HAND] = 1234;
    });
    world.advance(2);
    return world;
}

describe("a warlock with an empty weapon", () => {
    it("sees the stone glow while there is one in the bags", () => {
        const world = createWarlockWorld(1);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("sees the spell that makes the stone glow once there is none", () => {
        const world = createWarlockWorld(0);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });
});

describe("a warlock with an empty weapon, no stone and no Soul Shard", () => {
    it("sees nothing of the stone glow: it cannot be made", () => {
        const world = createWarlockWorld(0);
        world.state.unusableSpells[CREATE_FIRESTONE.id] = true;
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(0);
    });
});
