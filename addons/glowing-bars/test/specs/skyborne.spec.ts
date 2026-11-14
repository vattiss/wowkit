// The Skyborne's racial cooldowns: Read Leyline (regeneration, Alliance) and Skysight (run speed, Horde) are for between
// fights, so they glow when ready out of combat by their own default look, and not in a fight. Walk on Air saves a fall,
// which can come in a fight too: it glows when ready anywhere.
import { createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

const READ_LEYLINE: SpellDefinition = { id: 1259705, name: "Read Leyline", rank: 1, icon: 136116, cooldownSeconds: 120 };
const WALK_ON_AIR: SpellDefinition = { id: 1259416, name: "Walk on Air", rank: 1, icon: 136094, cooldownSeconds: 90 };
const SKYSIGHT: SpellDefinition = { id: 1259686, name: "Skysight", rank: 1, icon: 136022, cooldownSeconds: 120 };

function startFight(world: World): void {
    world.state.isInCombat = true;
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(0.5);
}

/** A Skyborne with the racial learned and on button 1; the client knows the names of the others, as it does in the game. */
function createSkyborne(racial: SpellDefinition): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        for (const spell of [READ_LEYLINE, SKYSIGHT, WALK_ON_AIR]) state.spells[spell.id] = spell;
        learnSpell(state, racial);
        state.bars[1] = racial.id;
    });
    world.advance(1);
    return world;
}

describe("the Skyborne's racial cooldowns", () => {
    for (const racial of [READ_LEYLINE, SKYSIGHT]) {
        it(`lights ${racial.name} when ready out of combat, and not in a fight`, () => {
            const world = createSkyborne(racial);
            expect(world.glowsOn(1)).toBe(1);
            world.advance(3);
            startFight(world);
            expect(world.glowsOn(1)).toBe(0);
        });
    }

    it("lights Walk on Air when ready, in a fight too", () => {
        const world = createSkyborne(WALK_ON_AIR);
        expect(world.glowsOn(1)).toBe(1);
        world.advance(3);
        startFight(world);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("lists the learned one in the table, and not the other faction's", () => {
        const world = createSkyborne(SKYSIGHT);
        toggleTable();
        expect(findLabel(world, "Skysight")).not.toBe(undefined);
        expect(findLabel(world, "Read Leyline")).toBe(undefined);
        toggleTable();
    });
});
