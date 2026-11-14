// Exorcism, the paladin's proc on undead and demons (an idea of sorrow8's fork): it glows while it is ready and the target
// is one it hits, by the target's creature type, which is the same in every client language. Where the game hides the
// type, the spell's range check stands in.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    PALADIN,
    playAs,
    targetEnemy,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const EXORCISM: SpellDefinition = { id: 879, name: "Exorcism", rank: 1, icon: 135903, maxRange: 30, isHarmful: true, cooldownSeconds: 15 };
const CREATURE = { Humanoid: 7, Demon: 3, Undead: 6 };

/** A paladin with Exorcism on button 1, and a target of this creature type (none: no target; "hidden": its type is not shown). */
function createPaladin(creatureTypeId: number | "hidden" | undefined, yards = 25): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        learnSpell(state, EXORCISM);
        state.bars[1] = EXORCISM.id;
        if (creatureTypeId === undefined) return;
        targetEnemy(state, { yards, creatureTypeId: creatureTypeId === "hidden" ? undefined : creatureTypeId });
    });
    world.advance(1);
    return world;
}

describe("Exorcism, a paladin's proc on undead and demons", () => {
    it("glows with an undead or a demon targeted", () => {
        expect(createPaladin(CREATURE.Undead).glowsOn(1)).toBe(1);
        expect(createPaladin(CREATURE.Demon).glowsOn(1)).toBe(1);
    });

    it("does not glow with another creature targeted, nor with none", () => {
        expect(createPaladin(CREATURE.Humanoid).glowsOn(1)).toBe(0);
        expect(createPaladin(undefined).glowsOn(1)).toBe(0);
    });

    it("goes by the spell's range when the game hides the target's type", () => {
        expect(createPaladin("hidden").glowsOn(1)).toBe(1);
        expect(createPaladin("hidden", 40).glowsOn(1)).toBe(0);
    });

    it("does not glow while it is on its cooldown", () => {
        const world = createPaladin(CREATURE.Undead);
        world.state.cooldowns[EXORCISM.id] = { start: GetTime(), duration: 15 };
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("follows a change of target at once", () => {
        const world = createPaladin(CREATURE.Humanoid);
        expect(world.glowsOn(1)).toBe(0);
        targetEnemy(world.state, { creatureTypeId: CREATURE.Undead });
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(1);
    });
});
