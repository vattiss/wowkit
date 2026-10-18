import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    PRIEST,
    targetEnemy,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const SMITE: SpellDefinition = { id: 585, name: "Smite", rank: 1, icon: 135924, castTimeMs: 1500, maxRange: 30, isHarmful: true };
const PAIN: SpellDefinition = { id: 589, name: "Shadow Word: Pain", rank: 1, icon: 136207, maxRange: 30, isHarmful: true };
const LESSER_HEAL: SpellDefinition = {
    id: 2050,
    name: "Lesser Heal",
    rank: 1,
    icon: 135929,
    castTimeMs: 1500,
    maxRange: 40,
    isHelpful: true,
    description: "Heal your target for 46 to 56.",
};
const DISPEL_MAGIC: SpellDefinition = { id: 527, name: "Dispel Magic", rank: 1, icon: 135894, maxRange: 30, isHelpful: true };

/** A priest with Smite on button 1, Shadow Word: Pain on 2, Lesser Heal on 3 and Dispel Magic on 4, an enemy at range. */
function setUpPriest(state: ClientState): void {
    playAs(state, PRIEST);
    for (const spell of [SMITE, PAIN, LESSER_HEAL, DISPEL_MAGIC]) learnSpell(state, spell);
    state.bars[1] = SMITE.id;
    state.bars[2] = PAIN.id;
    state.bars[3] = LESSER_HEAL.id;
    state.bars[4] = DISPEL_MAGIC.id;
    targetEnemy(state);
}

describe("a priest with an enemy at range", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpPriest);
        world.advance(1);
    });

    it("opens with the cast-time spell out of combat: its cast is free while the mob runs in", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("keeps the DoT up first in combat", () => {
        world.state.isInCombat = true;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes on with the filler once the DoT is cast", () => {
        world.state.isInCombat = true;
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", PAIN.id);
        world.state.target!.debuffs.push(world.makeAura(PAIN.name, PAIN.id, 18, "player"));
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("offers the DoT again on a new target", () => {
        world.state.isInCombat = true;
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", PAIN.id);
        world.advance(0.5);
        targetEnemy(world.state, { name: "Defias Pillager" });
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("lights the heal when the health is low", () => {
        world.state.isInCombat = true;
        world.state.health = 30;
        world.advance(0.5);
        expect(world.glowsOn(3)).toBe(1);
    });

    it("fades the heal in by the health the game hides in combat: lit when low, dark when high", () => {
        world.state.isInCombat = true;
        world.advance(0.5);
        world.state.isHealthHidden = true;
        world.state.health = 30;
        world.advance(0.5);
        expect(world.glowAlphasOn(3)).toEqual([1]);
        world.state.health = 98;
        world.advance(0.5);
        expect(world.glowAlphasOn(3)).toEqual([0]);
    });

    it("lights the cleanse for a magic effect on the priest", () => {
        world.state.playerDebuffs.push({ ...world.makeAura("Frost Nova", 122, 8), dispelName: "Magic" });
        world.advance(0.5);
        expect(world.glowsOn(4)).toBe(1);
    });

    it("lights nothing while resting in town out of combat", () => {
        world.state.isResting = true;
        world.advance(0.5);
        expect(world.glowsOn(1) + world.glowsOn(2)).toBe(0);
    });

    it("lights nothing when the player disabled the addon on this character", () => {
        world.setOption("isMuted", true);
        world.advance(0.5);
        expect(world.glowsOn(1) + world.glowsOn(2)).toBe(0);
    });

    it("lights nothing without an enemy", () => {
        world.state.target = undefined;
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.5);
        expect(world.glowsOn(1) + world.glowsOn(2)).toBe(0);
    });
});
