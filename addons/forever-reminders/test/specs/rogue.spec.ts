import { beforeEach, describe, expect, it, learnSpell, playAs, createWorld, type World } from "@forever/test-kit";
import { DEADLY_POISON, INSTANT_POISON, ROGUE } from "./fixtures";

const MAIN_HAND = 16;
const OFF_HAND = 17;
const ONE_HOUR_MS = 3600 * 1000;
/** Enchant IDs the client reports while a poison is on a weapon (src/data/weapon-buffs.ts). */
const INSTANT_ENCHANT = 323;
const DEADLY_ENCHANT = 7;

function poisonLasting(enchantID: number, seconds: number): { enchantID: number; remainingTimeMs: number } {
    return { enchantID, remainingTimeMs: seconds * 1000 };
}

describe("a rogue with two weapons", () => {
    let world!: World;

    // Instant Poison is on button 5 and Deadly Poison on button 6. The main hand takes Instant by
    // default and the off-hand Deadly; the world is two seconds into the session
    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, ROGUE);
            learnSpell(state, INSTANT_POISON);
            learnSpell(state, DEADLY_POISON);
            state.bars[5] = INSTANT_POISON.id;
            state.bars[6] = DEADLY_POISON.id;
            state.equippedItems[MAIN_HAND] = 1234;
            state.equippedItems[OFF_HAND] = 5678;
        });
        world.advance(2);
    });

    it("is asked for the main hand poison first when neither weapon is coated", () => {
        expect(world.glowsOn(5)).toBe(1);
        expect(world.glowsOn(6)).toBe(0);
    });

    // The enchant event is taken for the player's own cast: a grace time of three seconds starts
    it("is asked for the off-hand poison once the main hand is coated", () => {
        world.state.enchants[MAIN_HAND] = poisonLasting(INSTANT_ENCHANT, 3600);
        world.fire("WEAPON_ENCHANT_CHANGED");
        world.advance(4);
        expect(world.glowsOn(5)).toBe(0);
        expect(world.glowsOn(6)).toBe(1);
    });

    it("sees no glow when both weapons are coated", () => {
        world.state.enchants[MAIN_HAND] = poisonLasting(INSTANT_ENCHANT, 3600);
        world.state.enchants[OFF_HAND] = poisonLasting(DEADLY_ENCHANT, 3600);
        world.fire("WEAPON_ENCHANT_CHANGED");
        world.advance(2);
        expect(world.glowsOn(5)).toBe(0);
        expect(world.glowsOn(6)).toBe(0);
    });

    it("is asked for a poison that is about to run out", () => {
        world.state.enchants[MAIN_HAND] = poisonLasting(INSTANT_ENCHANT, 3600);
        world.state.enchants[OFF_HAND] = poisonLasting(DEADLY_ENCHANT, 20);
        world.fire("WEAPON_ENCHANT_CHANGED");
        world.advance(2);
        expect(world.glowsOn(5)).toBe(0);
        expect(world.glowsOn(6)).toBe(1);
    });

    it("is asked for the wanted poison when another one is on the weapon", () => {
        // Deadly Poison on the main hand, where Instant Poison is wanted
        world.state.enchants[MAIN_HAND] = poisonLasting(DEADLY_ENCHANT, ONE_HOUR_MS / 1000);
        world.state.enchants[OFF_HAND] = poisonLasting(DEADLY_ENCHANT, ONE_HOUR_MS / 1000);
        world.fire("WEAPON_ENCHANT_CHANGED");
        world.advance(4);
        expect(world.glowsOn(5)).toBe(1);
    });

    it("stays quiet when the client gives no answer", () => {
        world.state.areEnchantReadsBroken = true;
        world.advance(3);
        expect(world.glowsOn(5)).toBe(0);
        expect(world.glowsOn(6)).toBe(0);
    });

    it("does not wait for the main hand poison for ever after a cast", () => {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", INSTANT_POISON.id);
        world.advance(0.5);
        expect(world.glowsOn(5)).toBe(0);
        world.advance(5);
        expect(world.glowsOn(5)).toBe(1);
    });
});
