// Buffs the game keeps secret (issue #88): in a dungeon or a raid it restricts the auras and leaves some out of the list, as
// if they were not there. A buff seen before is trusted to its end, one cast there to the length learned from its aura; one
// whose end is not known is not asked for, rather than while it may be up. In the open world, and for a buff seen in the
// same fight, nothing changes: a buff that falls off glows at once (issue #92).
import {
    BATTLE_SHOUT,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    PRIEST,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { createPlayer, enterDungeon, FOOD_ITEM, FOOD_SPELL, OTHER_AURA, putOn, runOut, WARD, WELL_FED } from "./secret-auras.helpers";

describe("a buff seen before the game kept it secret", () => {
    it("is not asked for while up, and is once its time runs out", () => {
        const world = createPlayer(WARD);
        putOn(world, WARD, 60);
        enterDungeon(world);
        world.advance(30);
        expect(world.glowsOn(1)).toBe(0);
        runOut(world, WARD, 30);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is asked for in the dungeon when it was gone already before", () => {
        const world = createPlayer(WARD);
        enterDungeon(world);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a buff cast where the game keeps it secret", () => {
    it("is followed to its end by the length learned from its aura before", () => {
        const world = createPlayer(WARD);
        putOn(world, WARD, 120);
        world.state.auras = world.state.auras.filter((aura) => aura.spellId !== WARD.id);
        world.advance(1);
        enterDungeon(world);
        putOn(world, WARD, 120);
        world.advance(100);
        expect(world.glowsOn(1)).toBe(0);
        runOut(world, WARD, 20);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is not asked for when its length was never seen, and the chat says so once", () => {
        const world = createPlayer(WARD);
        enterDungeon(world);
        putOn(world, WARD, 120);
        world.advance(60);
        expect(world.glowsOn(1)).toBe(0);
        putOn(world, WARD, 120);
        world.advance(5);
        expect(world.chat.filter((line) => line.includes("the game hides Magical Awareness here")).length).toBe(1);
    });

    it("says nothing in the chat with its switch off", () => {
        const world = createPlayer(WARD, { saved: { shouldNoteHiddenBuffs: false } });
        enterDungeon(world);
        putOn(world, WARD, 120);
        world.advance(5);
        expect(world.chat.filter((line) => line.includes("the game hides")).length).toBe(0);
    });
});

describe("a food eaten where Well Fed is kept secret", () => {
    /** A priest with a food added on button 1, well fed for 60 more seconds, then in a dungeon. */
    function createFed(): World {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.spells[FOOD_SPELL] = { id: FOOD_SPELL, name: "Food", rank: 1, icon: 1 };
                state.itemUseSpells[FOOD_ITEM] = FOOD_SPELL;
                state.barItems[1] = FOOD_ITEM;
                state.bags[FOOD_ITEM] = 5;
                state.auraSecrecy.hiddenSpells[WELL_FED] = true;
            },
            { addedSpells: [{ id: FOOD_SPELL, reminderType: "missingBuff" }] },
        );
        world.state.auras.push({ ...OTHER_AURA }, world.makeAura("Well Fed", WELL_FED, 60));
        world.advance(1);
        enterDungeon(world);
        return world;
    }

    it("is asked for once the Well Fed seen before runs out", () => {
        const world = createFed();
        world.advance(30);
        expect(world.glowsOn(1)).toBe(0);
        runOut(world, { id: WELL_FED, name: "Well Fed", rank: 1, icon: 1 }, 30);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is not asked for after one was eaten there: the new Well Fed's end cannot be seen", () => {
        const world = createFed();
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", FOOD_SPELL);
        world.state.auras = world.state.auras.filter((aura) => aura.spellId !== WELL_FED);
        world.state.auras.push(world.makeAura("Well Fed", WELL_FED, 900));
        world.advance(90);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("is asked for again after dying, though the Well Fed eaten there was out of sight", () => {
        const world = createFed();
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", FOOD_SPELL);
        world.advance(90);
        world.state.auras = [{ ...OTHER_AURA }];
        world.fire("PLAYER_DEAD");
        world.advance(2);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a death where the game keeps the buffs secret", () => {
    it("asks for a class buff at once, and not for an added one (a flask stays)", () => {
        const warrior = createPlayer(BATTLE_SHOUT, { isWarrior: true });
        putOn(warrior, BATTLE_SHOUT, 180);
        enterDungeon(warrior);
        warrior.state.auras = [{ ...OTHER_AURA }];
        warrior.fire("PLAYER_DEAD");
        warrior.advance(2);
        expect(warrior.glowsOn(1)).toBe(1);
        const priest = createPlayer(WARD);
        putOn(priest, WARD, 3600);
        enterDungeon(priest);
        priest.state.auras = [{ ...OTHER_AURA }];
        priest.fire("PLAYER_DEAD");
        priest.advance(2);
        expect(priest.glowsOn(1)).toBe(0);
    });
});

describe("a buff the game says may be secret, in a fight in the open world (issue #92)", () => {
    it("glows at once when it falls off after being seen in the same fight", () => {
        const world = createPlayer(BATTLE_SHOUT, { isWarrior: true });
        putOn(world, BATTLE_SHOUT, 180);
        world.state.isInCombat = true;
        world.state.auraSecrecy.saysRestricted = true;
        world.state.auraSecrecy.saysSecretOthers = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(2);
        world.state.auras = [{ ...OTHER_AURA }];
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("keeps a buff cast a moment before a fight whose list comes back empty", () => {
        const world = createPlayer(BATTLE_SHOUT, { isWarrior: true });
        putOn(world, BATTLE_SHOUT, 180);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("the length learned of a buff", () => {
    it("is the player's own aura's: another player's longer one does not change it", () => {
        const world = createPlayer(WARD);
        putOn(world, WARD, 120);
        world.state.auras = world.state.auras.filter((aura) => aura.spellId !== WARD.id);
        world.state.auras.push(world.makeAura(WARD.name, WARD.id, 3600, "party1"));
        world.advance(1);
        world.state.auras = world.state.auras.filter((aura) => aura.spellId !== WARD.id);
        world.advance(1);
        enterDungeon(world);
        putOn(world, WARD, 120);
        runOut(world, WARD, 120);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a tracking where the game keeps it secret", () => {
    const FIND_TREASURE: SpellDefinition = { id: 2481, name: "Find Treasure", rank: 1, icon: 135725, isHelpful: true };

    it("is not asked for after dying: a tracking may stay on", () => {
        const world = createWorld((state) => {
            playAs(state, { name: "Paladin", token: "PALADIN", id: 2 });
            learnSpell(state, FIND_TREASURE);
            state.bars[1] = FIND_TREASURE.id;
            state.auraSecrecy.hiddenSpells[FIND_TREASURE.id] = true;
        });
        const tracking = { name: FIND_TREASURE.name, spellId: FIND_TREASURE.id, expirationTime: 0 };
        world.state.auras = [{ ...OTHER_AURA }, tracking];
        world.advance(1);
        enterDungeon(world);
        world.fire("PLAYER_DEAD");
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
    });
});
