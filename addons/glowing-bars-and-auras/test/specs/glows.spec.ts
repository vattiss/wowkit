import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    WARRIOR,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const OVERPOWER: SpellDefinition = { id: 7384, name: "Overpower", rank: 1, icon: 132223, maxRange: 5, isHarmful: true };
const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 300, isHelpful: true };

/** A warrior with Overpower on button 1 and Recklessness on button 2. */
function setUpWarrior(state: ClientState): void {
    playAs(state, WARRIOR);
    for (const spell of [OVERPOWER, RECKLESSNESS]) learnSpell(state, spell);
    state.bars[1] = OVERPOWER.id;
    state.bars[2] = RECKLESSNESS.id;
    state.unusableSpells[OVERPOWER.id] = true;
}

describe("a warrior with Overpower and Recklessness on the bars", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpWarrior);
        world.advance(1);
    });

    it("sees no glow on Overpower until the game says it can be used", () => {
        expect(world.glowsOn(1)).toBe(0);
        world.state.unusableSpells[OVERPOWER.id] = undefined;
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("loses the glow of Overpower when it goes on cooldown", () => {
        world.state.unusableSpells[OVERPOWER.id] = undefined;
        world.advance(0.5);
        world.state.cooldowns[OVERPOWER.id] = { start: 0, duration: 99999 };
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("does not light Recklessness in combat before it has been used in the fight", () => {
        world.state.isInCombat = true;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("lights Recklessness in combat once it is back after it was used in the fight", () => {
        world.state.isInCombat = true;
        world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
        world.state.cooldowns[RECKLESSNESS.id] = undefined;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("forgets the cooldowns of the last fight when a new one starts", () => {
        world.state.isInCombat = true;
        world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
        world.advance(0.5);
        world.state.cooldowns[RECKLESSNESS.id] = undefined;
        world.advance(0.5);
        world.state.isInCombat = false;
        world.fire("PLAYER_REGEN_ENABLED");
        world.advance(0.5);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("lights Recklessness out of combat when the player asked for it", () => {
        world.setOption("showCooldownsOutOfCombat", true);
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("puts the glow out while Recklessness is on cooldown", () => {
        world.state.isInCombat = true;
        world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("puts the glow out at the cast, before the client tells the cooldown", () => {
        world.state.isInCombat = true;
        world.advance(0.5);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", RECKLESSNESS.id);
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("has the glow back when the cooldown is over", () => {
        world.state.isInCombat = true;
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", RECKLESSNESS.id);
        world.advance(301);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("lights no cooldown the player switched off", () => {
        world.setOption("glow_1719", false);
        world.state.isInCombat = true;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("lights no cooldown when the player switched the cooldown glows off", () => {
        world.setOption("showCooldowns", false);
        world.state.isInCombat = true;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("lights nothing when the player disabled the addon on this character", () => {
        world.setOption("isMuted", true);
        world.state.isInCombat = true;
        world.state.unusableSpells[OVERPOWER.id] = undefined;
        world.advance(0.5);
        expect(world.glowsOn(1) + world.glowsOn(2)).toBe(0);
    });
});
