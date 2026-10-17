import { beforeEach, describe, expect, it } from "../framework";
import { learnSpell, playAs } from "../world/client-state";
import { createWorld, type World } from "../world/world";
import { ALARM_SOUND, LIGHTNING_SHIELD, ROCKBITER_WEAPON, SHAMAN } from "./fixtures";

const MAIN_HAND = 16;
const ONE_HOUR_MS = 3600 * 1000;

describe("a shaman", () => {
    let world!: World;

    // Rockbiter is on button 3, Lightning Shield on button 4; a weapon is equipped and nothing is on it.
    // The world is two seconds into the session: a missing weapon buff must hold for a moment to count.
    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, SHAMAN);
            learnSpell(state, ROCKBITER_WEAPON);
            learnSpell(state, LIGHTNING_SHIELD);
            state.bars[3] = ROCKBITER_WEAPON.id;
            state.bars[4] = LIGHTNING_SHIELD.id;
            state.equippedItems[MAIN_HAND] = 1234;
        });
        world.advance(2);
    });

    describe("without a weapon buff or a shield", () => {
        it("sees the weapon buff glow", () => {
            expect(world.glowsOn(3)).toBe(1);
        });

        it("sees the shield glow too", () => {
            expect(world.glowsOn(4)).toBe(1);
        });

        it("hears the weapon alarm once", () => {
            expect(world.sounds).toEqual([ALARM_SOUND]);
        });

        it("does not hear it again", () => {
            world.advance(2);
            expect(world.sounds.length).toBe(1);
        });
    });

    describe("casting the shield", () => {
        beforeEach(() => {
            world.state.auras.push(world.makeAura(LIGHTNING_SHIELD.name, LIGHTNING_SHIELD.id, 600));
            world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", LIGHTNING_SHIELD.id);
            world.advance(0.5);
        });

        it("puts the shield glow out", () => {
            expect(world.glowsOn(4)).toBe(0);
        });

        // A cast of another spell must not be taken for putting on the weapon buff
        it("leaves the weapon glow on", () => {
            expect(world.glowsOn(3)).toBe(1);
        });
    });

    describe("the weapon buff", () => {
        it("puts the glow out once it is on the weapon", () => {
            world.state.enchants[MAIN_HAND] = { enchantID: 1, remainingTimeMs: ONE_HOUR_MS };
            world.fire("WEAPON_ENCHANT_CHANGED");
            world.advance(1);
            expect(world.glowsOn(3)).toBe(0);
        });

        it("makes the glow come back when it is about to run out", () => {
            world.state.enchants[MAIN_HAND] = { enchantID: 1, remainingTimeMs: ONE_HOUR_MS };
            world.fire("WEAPON_ENCHANT_CHANGED");
            world.advance(1);
            world.state.enchants[MAIN_HAND] = { enchantID: 1, remainingTimeMs: 20 * 1000 };
            world.advance(1);
            expect(world.glowsOn(3)).toBe(1);
        });

        it("has no glow when the player switched the weapon reminder off", () => {
            world.setOption("showWeapon", false);
            expect(world.glowsOn(3)).toBe(0);
        });
    });
});
