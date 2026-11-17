// The two places of a weapon's enchants on Forever, held at once: the imbue of a class (a warlock's Firestone, a rogue's
// poisons) and a temporary enchant (oils, stones). The class's weapon buff looks at the imbue alone, one the player added
// (an oil, a stone) at the temporary enchant alone: neither covers the other (issue #78).
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    ROGUE,
    INSTANT_POISON,
    DEADLY_POISON,
    type CharacterClass,
    type World,
} from "@wowkit/test-kit";

const WARLOCK: CharacterClass = { name: "Warlock", token: "WARLOCK", id: 9 };
const MAIN_HAND = 16;
const OFF_HAND = 17;
const CREATE_FIRESTONE = { id: 6366, name: "Create Firestone", rank: 1, icon: 132386, isHelpful: true };
const FIRESTONE = { item: 13701, spell: 17949, name: "Major Firestone", enchant: 1803 };
const OIL = { item: 20744, spell: 25117, name: "Minor Wizard Oil", enchant: 2623 };

/** The warlock of issue #78: Create Firestone on 1, a Major Firestone on 2, Minor Wizard Oil on 3 (added on the Buffs tab). */
function createWarlock(hasFirestone: boolean, hasOil: boolean): World {
    const world = createWorld(
        (state) => {
            playAs(state, WARLOCK);
            learnSpell(state, CREATE_FIRESTONE);
            state.bars[1] = CREATE_FIRESTONE.id;
            for (const stone of [FIRESTONE, OIL]) {
                state.spells[stone.spell] = { id: stone.spell, name: stone.name, rank: 1, icon: 1, isHelpful: true };
                state.itemUseSpells[stone.item] = stone.spell;
            }
            state.barItems[2] = FIRESTONE.item;
            state.bags[FIRESTONE.item] = 1;
            state.barItems[3] = OIL.item;
            state.bags[OIL.item] = 2;
            state.equippedItems[MAIN_HAND] = 1234;
            if (hasFirestone) state.enchants[MAIN_HAND] = { enchantID: FIRESTONE.enchant, remainingTimeMs: 3600000 };
            if (hasOil) state.temporaryEnchants[MAIN_HAND] = { enchantID: OIL.enchant, remainingTimeMs: 1800000 };
        },
        { addedSpells: [{ id: OIL.spell, reminderType: "weaponBuff" }] },
    );
    world.advance(4);
    return world;
}

describe("a warlock's Firestone and Minor Wizard Oil on one staff (issue #78)", () => {
    it("asks for the oil next to the Firestone", () => {
        const world = createWarlock(true, false);
        expect(world.glowsOn(3)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("asks for the Firestone next to the oil", () => {
        const world = createWarlock(false, true);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(3)).toBe(0);
    });

    it("asks for nothing with both on", () => {
        const world = createWarlock(true, true);
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(3)).toBe(0);
    });

    it("asks for both on a bare staff", () => {
        const world = createWarlock(false, false);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(3)).toBe(1);
    });
});

describe("a rogue's poisons beside what else is on the weapons", () => {
    /** Instant Poison on 5, Deadly Poison on 6; each weapon with what it is given. */
    function createRogue(set: (state: World["state"]) => void): World {
        const world = createWorld((state) => {
            playAs(state, ROGUE);
            learnSpell(state, INSTANT_POISON);
            learnSpell(state, DEADLY_POISON);
            state.bars[5] = INSTANT_POISON.id;
            state.bars[6] = DEADLY_POISON.id;
            state.equippedItems[MAIN_HAND] = 1234;
            state.equippedItems[OFF_HAND] = 5678;
            set(state);
        });
        world.advance(4);
        return world;
    }

    it("asks for the main hand's poison beside a stone no rule knows: a temporary enchant covers only its own place", () => {
        const world = createRogue((state) => {
            state.temporaryEnchants[MAIN_HAND] = { enchantID: 4242, remainingTimeMs: 1800000 };
            state.enchants[OFF_HAND] = { enchantID: 7, remainingTimeMs: 3600000 };
        });
        expect(world.glowsOn(5)).toBe(1);
    });

    it("lets an imbue no rule knows cover the main hand, as before", () => {
        const world = createRogue((state) => {
            state.enchants[MAIN_HAND] = { enchantID: 4242, remainingTimeMs: 1800000 };
            state.enchants[OFF_HAND] = { enchantID: 7, remainingTimeMs: 3600000 };
        });
        expect(world.glowsOn(5)).toBe(0);
    });

    it("asks for a poison again in its last seconds: the time left is read in milliseconds", () => {
        const world = createRogue((state) => {
            state.enchants[MAIN_HAND] = { enchantID: 323, remainingTimeMs: 8000 };
            state.enchants[OFF_HAND] = { enchantID: 7, remainingTimeMs: 3600000 };
        });
        expect(world.glowsOn(5)).toBe(1);
    });
});

/** A stone's temporary enchant, and Instant Poison's imbue: on Forever held at once. */
const STONE_ENCHANT = 14;
const INSTANT_ENCHANT = 323;
const poisonLasting = (enchantID: number, seconds: number) => ({ enchantID, remainingTimeMs: seconds * 1000 });

const TWO_BUTTON_MACRO = "#showtooltip\n/use [button:1] Instant Poison II; [button:2] Coarse Weightstone\n/use 17";
const WEIGHTSTONE = { item: 3240, spell: 3113 };
const IN_COMBAT_ONLY = { spellStyles: { "weaponBuff:Instant Poison": { when: "inCombat" } } };

/**
 * A rogue with one macro for the off-hand: Instant Poison II by the left button, a Coarse Weightstone (added as a weapon
 * buff) by the right. Instant Poison on the main hand unless `isMainBare`; on the off-hand, the poison and the weightstone as asked.
 */
function createTwoButtonMacro(hasPoison: boolean, hasStone: boolean, isMainBare = false, saved: Record<string, unknown> = {}): World {
    const world = createWorld(
        (state) => {
            playAs(state, ROGUE);
            state.spells[8679] = { id: 8679, name: "Instant Poison", rank: 1, icon: 132273, isHelpful: true };
            state.spells[8686] = { id: 8686, name: "Instant Poison II", rank: 1, icon: 132273, isHelpful: true };
            state.spells[WEIGHTSTONE.spell] = { id: WEIGHTSTONE.spell, name: "Weighted Blade", rank: 1, icon: 135255, isHelpful: true };
            state.itemUseSpells[6949] = 8686;
            state.itemIds["Instant Poison II"] = 6949;
            state.bags[6949] = 5;
            state.itemUseSpells[WEIGHTSTONE.item] = WEIGHTSTONE.spell;
            state.itemIds["Coarse Weightstone"] = WEIGHTSTONE.item;
            state.bags[WEIGHTSTONE.item] = 5;
            state.barMacros[1] = { body: TWO_BUTTON_MACRO };
            state.equippedItems[MAIN_HAND] = 1234;
            state.equippedItems[OFF_HAND] = 5678;
            if (!isMainBare) state.enchants[MAIN_HAND] = poisonLasting(INSTANT_ENCHANT, 3600);
            if (hasPoison) state.enchants[OFF_HAND] = poisonLasting(INSTANT_ENCHANT, 3600);
            if (hasStone) state.temporaryEnchants[OFF_HAND] = poisonLasting(STONE_ENCHANT, 1800);
        },
        { addedSpells: [{ id: WEIGHTSTONE.spell, reminderType: "weaponBuff" }], ...saved },
    );
    world.advance(5);
    return world;
}

describe("a rogue with one macro for the off-hand: a poison by the left button, a weightstone by the right", () => {
    it("glows for the weightstone with the poison on", () => {
        expect(createTwoButtonMacro(true, false).glowsOn(1)).toBe(1);
    });

    it("glows for the poison with the weightstone on", () => {
        expect(createTwoButtonMacro(false, true).glowsOn(1)).toBe(1);
    });

    it("goes dark with both on", () => {
        expect(createTwoButtonMacro(true, true).glowsOn(1)).toBe(0);
    });

    it("still glows for the weightstone while the main hand needs its poison: only the poison waits for its weapon", () => {
        expect(createTwoButtonMacro(true, false, true).glowsOn(1)).toBe(1);
    });
});

describe("the two-button macro and the When of Instant Poison's row (issue #20)", () => {
    it("stays dark out of a fight for the missing poison, the weightstone on", () => {
        expect(createTwoButtonMacro(false, true, false, IN_COMBAT_ONLY).glowsOn(1)).toBe(0);
    });

    it("glows for the missing weightstone by its own row, whatever the poison's When", () => {
        expect(createTwoButtonMacro(true, false, false, IN_COMBAT_ONLY).glowsOn(1)).toBe(1);
    });
});

describe("an oil put on while the Firestone is asked for", () => {
    it("is not taken for the Firestone: it is still asked for", () => {
        const world = createWarlock(false, false);
        expect(world.glowsOn(2)).toBe(1);
        world.state.temporaryEnchants[MAIN_HAND] = { enchantID: OIL.enchant, remainingTimeMs: 1800000 };
        world.fire("WEAPON_ENCHANT_CHANGED");
        world.advance(10);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(3)).toBe(0);
    });
});

describe("the list of a weapon's enchants kept secret", () => {
    it("gives no answer: the oil is not asked for on a guess", () => {
        const world = createWarlock(false, false);
        world.state.isEnchantListSecret = true;
        world.advance(4);
        expect(world.glowsOn(3)).toBe(0);
    });
});
