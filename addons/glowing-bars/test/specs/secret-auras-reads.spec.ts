// Buffs the game keeps secret (issue #88), what the addon reads of them: a direct question the game refuses or answers with
// secret fields, a change in what C_Secrets says, a list read before a fight; a paladin's aura and a party member's buff; the
// chat note's switch and the lengths kept per character.
import {
    BATTLE_SHOUT,
    createWorld,
    describe,
    expect,
    FORTITUDE,
    it,
    learnSpell,
    playAs,
    POWER,
    PRIEST,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { replayCase } from "./secret-auras-fuzz.spec";
import { createPlayer, enterDungeon, OTHER_AURA, putOn, WARD } from "./secret-auras.helpers";

describe("the chat note's switch in the settings", () => {
    it("is there, and keeps the chat quiet once switched off", () => {
        const world = createPlayer(WARD);
        expect(world.hasOption("shouldNoteHiddenBuffs")).toBe(true);
        world.setOption("shouldNoteHiddenBuffs", false);
        expect(world.getSavedSettings()?.shouldNoteHiddenBuffs).toBe(false);
        enterDungeon(world);
        putOn(world, WARD, 120);
        world.advance(5);
        expect(world.chat.filter((line) => line.includes("the game hides")).length).toBe(0);
    });
});

describe("the length learned of a buff, kept", () => {
    it("is kept from an older build's key (with spaces), by the name's key now", () => {
        const world = createPlayer(WARD, { saved: { buffDurations: { "magical awareness": 90 } } });
        expect((world.getSavedSettings()?.buffDurations as Record<string, number> | undefined)?.magicalawareness).toBe(90);
    });

    it("is saved with the character's settings", () => {
        const world = createPlayer(WARD);
        putOn(world, WARD, 120);
        world.advance(1);
        expect((world.getSavedSettings()?.buffDurations as Record<string, number> | undefined)?.magicalawareness).toBe(120);
    });
});

describe("a direct question about a buff, while the game may hide it", () => {
    /** A buff seen with 60 seconds left, then hidden: left out of the list, C_Secrets saying plainly it is not secret. */
    function createHidden(direct: "error" | "secretFields"): World {
        const world = createPlayer(WARD);
        putOn(world, WARD, 60);
        world.state.auraSecrecy.isHiding = true;
        world.state.auraSecrecy.direct = direct;
        world.fire("PLAYER_ENTERING_WORLD");
        world.advance(1);
        return world;
    }

    it("left unanswered: the buff is trusted to the end seen before", () => {
        const world = createHidden("error");
        world.advance(30);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("answered with its fields secret: the buff is up", () => {
        const world = createHidden("secretFields");
        world.advance(120);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a buff seen in a fight, then said to be secret in another way", () => {
    it("is not taken for gone when it drops out of the list: what C_Secrets says of it changed", () => {
        const world = createPlayer(BATTLE_SHOUT, { isWarrior: true });
        const secrecy = world.state.auraSecrecy;
        secrecy.saysRestricted = true;
        secrecy.saysSecret[BATTLE_SHOUT.id] = true;
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        putOn(world, BATTLE_SHOUT, 180);
        world.advance(1);
        secrecy.saysSecret[BATTLE_SHOUT.id] = "error";
        secrecy.isHiding = true;
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a buff cast a moment before a fight that hides the list", () => {
    it("is kept: a list read before the fight began is not believed in it (seed 16 of the random test)", () => {
        expect(replayCase(0, 16)).toBe(undefined);
    });
});

describe("a paladin's aura where the game keeps it secret", () => {
    const DEVOTION_AURA: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };

    it("is asked for after dying: an aura of a category falls off with death", () => {
        const world = createWorld((state) => {
            playAs(state, { name: "Paladin", token: "PALADIN", id: 2 });
            learnSpell(state, DEVOTION_AURA);
            state.bars[1] = DEVOTION_AURA.id;
            state.auraSecrecy.hiddenSpells[DEVOTION_AURA.id] = true;
        });
        world.state.auras = [{ ...OTHER_AURA }];
        world.advance(1);
        putOn(world, DEVOTION_AURA, 99999);
        enterDungeon(world);
        expect(world.glowsOn(1)).toBe(0);
        world.state.auras = [{ ...OTHER_AURA }];
        world.fire("PLAYER_DEAD");
        world.advance(2);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a party member's buff where the game may keep it secret", () => {
    it("is not counted as missing, though it is out of the open world", () => {
        const createPriest = (isInDungeon: boolean): World => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, FORTITUDE);
                    state.bars[1] = FORTITUDE.id;
                    state.party = [{ name: "Bob", classToken: "WARRIOR", power: POWER.Rage, auras: [] }];
                    state.auraSecrecy.hiddenSpells[FORTITUDE.id] = true;
                },
                { styles: { missingBuff: { isMessageOn: true } } },
            );
            world.state.auras = [{ ...OTHER_AURA }, world.makeAura(FORTITUDE.name, FORTITUDE.id, 3600, "player")];
            world.advance(1);
            if (isInDungeon) enterDungeon(world);
            world.advance(1);
            return world;
        };
        expect(createPriest(false).notice()).toContain("missing on: Bob");
        expect(createPriest(true).notice()).not.toContain("missing on: Bob");
    });
});
