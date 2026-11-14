// The Skyborne's racial cooldowns: Read Leyline (regeneration, Alliance), Skysight (run speed, Horde) and Walk on Air (a
// fall). Each can be of use in a fight or out of one, so each glows when ready anywhere by its own default look: once, not
// again as a fight starts.
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
    for (const racial of [READ_LEYLINE, SKYSIGHT, WALK_ON_AIR]) {
        it(`lights ${racial.name} once when ready, in a fight too, and not again as one starts`, () => {
            const world = createSkyborne(racial);
            expect(world.glowsOn(1)).toBe(1);
            world.advance(3);
            startFight(world);
            expect(world.glowsOn(1)).toBe(0);
            // Used in the fight and ready again in it: it glows
            world.state.cooldowns[racial.id] = { start: 0, duration: 99999 };
            world.advance(1);
            world.state.cooldowns[racial.id] = undefined;
            world.advance(0.5);
            expect(world.glowsOn(1)).toBe(1);
        });
    }

    it("lists the learned one in the table, and not the other faction's", () => {
        const world = createSkyborne(SKYSIGHT);
        toggleTable();
        expect(findLabel(world, "Skysight")).not.toBe(undefined);
        expect(findLabel(world, "Read Leyline")).toBe(undefined);
        toggleTable();
    });
});
