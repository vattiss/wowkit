import { createWorld, describe, expect, it, learnSpell, playAs, MAGE, SHAMAN, type SpellDefinition, type World } from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

const WARLOCK = { name: "Warlock", token: "WARLOCK", id: 9 };
const MISSILES: SpellDefinition = { id: 5143, name: "Arcane Missiles", rank: 1, icon: 136096, maxRange: 30, isHarmful: true };
const SHADOW_BOLT: SpellDefinition = {
    id: 686,
    name: "Shadow Bolt",
    rank: 1,
    icon: 136197,
    maxRange: 30,
    isHarmful: true,
    castTimeMs: 1700,
};

const LIGHTNING_BOLT: SpellDefinition = { id: 403, name: "Lightning Bolt", rank: 1, icon: 136048, maxRange: 30, isHarmful: true };

/** A shaman with Lightning Bolt on button 1, cast in `castTimeMs` (0: instant, as with 5 stacks of Maelstrom Weapon). */
function createShaman(castTimeMs: number, saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, SHAMAN);
        learnSpell(state, { ...LIGHTNING_BOLT, castTimeMs });
        state.bars[1] = LIGHTNING_BOLT.id;
    }, saved);
    world.advance(1);
    return world;
}

function createMage(cost: number | undefined): World {
    const world = createWorld((state) => {
        playAs(state, MAGE);
        learnSpell(state, MISSILES);
        state.bars[1] = MISSILES.id;
        state.spellCosts[MISSILES.id] = cost;
    });
    world.advance(1);
    return world;
}

function createWarlock(): World {
    const world = createWorld((state) => {
        playAs(state, WARLOCK);
        learnSpell(state, SHADOW_BOLT);
        state.bars[1] = SHADOW_BOLT.id;
    });
    world.advance(1);
    return world;
}

describe("a proc told by its spell", () => {
    it("lights Arcane Missiles only while it is free", () => {
        const world = createMage(85);
        expect(world.glowsOn(1)).toBe(0);
        world.state.spellCosts[MISSILES.id] = 0;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("lights nothing while the game names no cost", () => {
        expect(createMage(undefined).glowsOn(1)).toBe(0);
    });

    it("lights Shadow Bolt only while it is instant", () => {
        const world = createWarlock();
        expect(world.glowsOn(1)).toBe(0);
        world.state.spells[SHADOW_BOLT.id]!.castTimeMs = 0;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("lights Lightning Bolt only while it is instant: 5 stacks of Maelstrom Weapon (issue #69)", () => {
        const world = createShaman(1500);
        expect(world.glowsOn(1)).toBe(0);
        world.state.spells[LIGHTNING_BOLT.id]!.castTimeMs = 0;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        world.state.spells[LIGHTNING_BOLT.id]!.castTimeMs = 1500;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("lights Lightning Bolt in a fight too, while it is instant", () => {
        const world = createShaman(1500);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        world.state.spells[LIGHTNING_BOLT.id]!.castTimeMs = 0;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("lights no Lightning Bolt the player switched off, instant or not", () => {
        expect(createShaman(0, { enabledSpells: { [tostring(LIGHTNING_BOLT.id)]: false } }).glowsOn(1)).toBe(0);
    });

    it("has one row for Lightning Bolt added by hand as a proc before it was built in, and its own for another type", () => {
        const listRows = (reminderType: string) => {
            const world = createWorld(
                (state) => {
                    playAs(state, SHAMAN);
                    learnSpell(state, { ...LIGHTNING_BOLT, castTimeMs: 1500 });
                    state.bars[1] = LIGHTNING_BOLT.id;
                },
                { addedSpells: [{ id: LIGHTNING_BOLT.id, reminderType }] },
            );
            world.advance(1);
            toggleTable();
            return world.frames
                .filter((frame) => frame.isShown && frame.fontStrings.some((line) => line.text === LIGHTNING_BOLT.name))
                .map((frame) => frame.fontStrings[1]?.text)
                .join(", ");
        };
        expect(listRows("proc")).toBe("Proc");
        expect(listRows("readyCooldown")).toBe("Ready cooldown, Proc");
    });

    it("has a row of its own in the table, under its plain name", () => {
        const world = createWarlock();
        toggleTable();
        expect(findLabel(world, "Shadow Bolt")).toBeDefined();
        expect(findLabel(world, "Shadow Bolt (alpha)")).toBeUndefined();
    });
});
