// Auras the client keeps secret (a dungeon): with the auras restricted, a secret spell's aura reads absent, so nothing tells
// it gone and it is not asked for. A buff whose aura is not secret is asked for as before.
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
    WARRIOR,
    type World,
} from "@wowkit/test-kit";

const WARD = { id: 1297774, name: "Magical Awareness", rank: 1, icon: 1, isHelpful: true };
const FOOD_ITEM = 13935;
const FOOD_SPELL = 18233;
const WELL_FED_IDS = [19705, 19710];

/** A priest with a buff of their own added (Magical Awareness, as an Arcane Censer gives) on button 1; in a dungeon if asked. */
function createWithWard(isUp: boolean, isRestricted: boolean, isSecret: boolean): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, WARD);
            state.bars[1] = WARD.id;
            state.areAurasRestricted = isRestricted;
            if (isSecret) state.secretAuraSpells[WARD.id] = true;
        },
        { addedSpells: [{ id: WARD.id, reminderType: "missingBuff" }] },
    );
    if (isUp) world.state.auras.push(world.makeAura(WARD.name, WARD.id, 3600));
    world.advance(1);
    return world;
}

describe("a buff the player added, its aura kept secret in a dungeon", () => {
    it("is not asked for while up: its aura reads absent", () => {
        expect(createWithWard(true, true, true).glowsOn(1)).toBe(0);
    });

    it("is not asked for while gone either: nothing tells it", () => {
        expect(createWithWard(false, true, true).glowsOn(1)).toBe(0);
    });

    it("is asked for while gone where its aura is not secret, in a dungeon or out of it", () => {
        expect(createWithWard(false, true, false).glowsOn(1)).toBe(1);
        expect(createWithWard(false, false, true).glowsOn(1)).toBe(1);
    });
});

describe("a food, Well Fed kept secret in a dungeon", () => {
    function createFood(isWellFed: boolean, isRestricted: boolean): World {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.spells[FOOD_SPELL] = { id: FOOD_SPELL, name: "Food", rank: 1, icon: 1 };
                state.itemUseSpells[FOOD_ITEM] = FOOD_SPELL;
                state.barItems[1] = FOOD_ITEM;
                state.bags[FOOD_ITEM] = 5;
                state.areAurasRestricted = isRestricted;
                for (const id of WELL_FED_IDS) state.secretAuraSpells[id] = true;
                if (isWellFed) state.auras.push({ name: "Well Fed", spellId: 19710, expirationTime: 99999 });
            },
            { addedSpells: [{ id: FOOD_SPELL, reminderType: "missingBuff" }] },
        );
        world.advance(1);
        return world;
    }

    it("is not asked for, well fed or not: Well Fed reads absent", () => {
        expect(createFood(true, true).glowsOn(1)).toBe(0);
        expect(createFood(false, true).glowsOn(1)).toBe(0);
    });

    it("is asked for out of the dungeon while not well fed", () => {
        expect(createFood(false, false).glowsOn(1)).toBe(1);
    });
});

describe("a class buff whose aura is not secret, in a dungeon", () => {
    it("is asked for once gone, as before", () => {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, BATTLE_SHOUT);
            state.bars[1] = BATTLE_SHOUT.id;
            state.areAurasRestricted = true;
        });
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a paladin's aura and a party member's buff, kept secret in a dungeon", () => {
    const PALADIN = { name: "Paladin", token: "PALADIN", id: 2 };
    const DEVOTION_AURA = { id: 465, name: "Devotion Aura", rank: 1, icon: 1, isHelpful: true };

    it("does not ask a paladin for an aura kept secret, and asks for one that is not", () => {
        const createPaladin = (isSecret: boolean) => {
            const world = createWorld((state) => {
                playAs(state, PALADIN);
                learnSpell(state, DEVOTION_AURA);
                state.bars[1] = DEVOTION_AURA.id;
                state.areAurasRestricted = true;
                if (isSecret) state.secretAuraSpells[DEVOTION_AURA.id] = true;
            });
            world.advance(1);
            return world;
        };
        expect(createPaladin(true).glowsOn(1)).toBe(0);
        expect(createPaladin(false).glowsOn(1)).toBe(1);
    });

    it("does not count a party member as missing a buff kept secret", () => {
        const createPriest = (isRestricted: boolean) => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, FORTITUDE);
                    state.bars[1] = FORTITUDE.id;
                    state.auras.push({ name: FORTITUDE.name, spellId: FORTITUDE.id, expirationTime: 99999 });
                    state.party = [{ name: "Bob", classToken: "WARRIOR", power: POWER.Rage, auras: [] }];
                    state.areAurasRestricted = isRestricted;
                    state.secretAuraSpells[FORTITUDE.id] = true;
                },
                { styles: { missingBuff: { isMessageOn: true } } },
            );
            world.advance(1);
            return world;
        };
        expect(createPriest(false).notice()).toContain("missing on: Bob");
        expect(createPriest(true).notice()).not.toContain("missing on: Bob");
    });
});
