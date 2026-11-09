import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type SpellDefinition, type World } from "@wowkit/test-kit";

const SLEEPING_BAG = 211527;
const USE_BAG: SpellDefinition = { id: 999100, name: "Sleeping Bag", rank: 1, icon: 1, isHelpful: true };
const WELL_RESTED: SpellDefinition = { id: 429959, name: "Well-Rested", rank: 1, icon: 1 };
const BASIC_CAMPFIRE: SpellDefinition = { id: 818, name: "Basic Campfire", rank: 1, icon: 1, isHelpful: true };
const CAMP_BENEFITS: SpellDefinition = { id: 1229741, name: "Camp Benefits", rank: 1, icon: 1 };

/** A priest with the spell added as a missing buff and on the bar. */
function createWithAdded(spell: SpellDefinition, buff: SpellDefinition): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, spell);
            state.spells[buff.id] = buff;
            state.bars[1] = spell.id;
            state.itemUseSpells[SLEEPING_BAG] = USE_BAG.id;
        },
        { addedSpells: [{ id: spell.id, reminderType: "missingBuff" }] },
    );
    world.advance(2);
    return world;
}

describe("an item or spell that gives a buff of another name", () => {
    it("glows while that buff is missing", () => {
        expect(createWithAdded(USE_BAG, WELL_RESTED).glowsOn(1)).toBe(1);
    });

    it("stops glowing once the sleeping bag's buff is on", () => {
        const world = createWithAdded(USE_BAG, WELL_RESTED);
        world.state.auras.push(world.makeAura(WELL_RESTED.name, WELL_RESTED.id, 3600));
        world.fire("UNIT_AURA", "player");
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("stops glowing once a campfire's buff is on", () => {
        const world = createWithAdded(BASIC_CAMPFIRE, CAMP_BENEFITS);
        expect(world.glowsOn(1)).toBe(1);
        world.state.auras.push(world.makeAura(CAMP_BENEFITS.name, CAMP_BENEFITS.id, 3600));
        world.fire("UNIT_AURA", "player");
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
    });
});
