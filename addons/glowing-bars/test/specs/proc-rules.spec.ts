// The proc rules (beta, "Use advanced proc rules"): the player's own rules beside the class's, by priority, with a result
// and a group. Switched off, the built-in engine goes on as before and the rules do nothing.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    PALADIN,
    playAs,
    targetEnemy,
    WARRIOR,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const HOLY_STRIKE: SpellDefinition = { id: 407676, name: "Holy Strike", rank: 1, icon: 135891, isHarmful: true };
const HOLY_SHIELD = { id: 20925, name: "Holy Shield" };
const EXORCISM: SpellDefinition = { id: 879, name: "Exorcism", rank: 1, icon: 135903, maxRange: 30, isHarmful: true, cooldownSeconds: 15 };
const REVENGE: SpellDefinition = { id: 6572, name: "Revenge", rank: 1, icon: 132353, isHarmful: true, cooldownSeconds: 5 };
const UNDEAD = 6;
const DEMON = 3;

/** A paladin with Holy Strike on button 1 and Exorcism on 2, with these saved settings, the rules on unless they say. */
function createPaladin(saved: Record<string, unknown>, setUp?: (world: World) => void): World {
    const world = createWorld(
        (state) => {
            playAs(state, PALADIN);
            learnSpell(state, HOLY_STRIKE);
            learnSpell(state, EXORCISM);
            state.spells[HOLY_SHIELD.id] = { ...HOLY_SHIELD, rank: 1, icon: 135880 };
            state.bars[1] = HOLY_STRIKE.id;
            state.bars[2] = EXORCISM.id;
        },
        { shouldUseProcRules: true, ...saved },
    );
    setUp?.(world);
    world.advance(1);
    return world;
}

function giveHolyShield(world: World): void {
    world.state.auras.push(world.makeAura(HOLY_SHIELD.name, HOLY_SHIELD.id, 10));
}

const HOLY_STRIKE_BY_SHIELD = { spellId: HOLY_STRIKE.id, kind: "buff", value: HOLY_SHIELD.id, result: "glow", priority: 1 };

describe("a proc rule of the player's", () => {
    it("lights Holy Strike while Holy Shield is up, and not without it", () => {
        expect(createPaladin({ procRules: [HOLY_STRIKE_BY_SHIELD] }, giveHolyShield).glowsOn(1)).toBe(1);
        expect(createPaladin({ procRules: [HOLY_STRIKE_BY_SHIELD] }).glowsOn(1)).toBe(0);
    });

    it("does nothing while the rules are switched off", () => {
        const world = createPaladin({ shouldUseProcRules: false, procRules: [HOLY_STRIKE_BY_SHIELD] }, giveHolyShield);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("keeps the spell dark by a No glow rule of a lower number, but not of a higher one", () => {
        const darkFirst = { spellId: HOLY_STRIKE.id, kind: "usable", result: "noGlow", priority: 1 };
        const shieldSecond = { ...HOLY_STRIKE_BY_SHIELD, priority: 2 };
        expect(createPaladin({ procRules: [darkFirst, shieldSecond] }, giveHolyShield).glowsOn(1)).toBe(0);
        const darkLater = { ...darkFirst, priority: 2 };
        expect(createPaladin({ procRules: [darkLater, HOLY_STRIKE_BY_SHIELD] }, giveHolyShield).glowsOn(1)).toBe(1);
    });

    it("lights the spell when a Glow and a No glow rule of the same number both hold", () => {
        const darkToo = { spellId: HOLY_STRIKE.id, kind: "usable", result: "noGlow", priority: 1 };
        expect(createPaladin({ procRules: [darkToo, HOLY_STRIKE_BY_SHIELD] }, giveHolyShield).glowsOn(1)).toBe(1);
    });

    it("takes the look of its group's row", () => {
        const grouped = { ...HOLY_STRIKE_BY_SHIELD, group: "shield" };
        const world = createPaladin(
            { procRules: [grouped], spellStyles: { "proc:Holy Strike (shield)": { glowPercent: 40 } } },
            giveHolyShield,
        );
        expect(world.glowAlphasOn(1)).toEqual([0.4]);
    });
});

describe("a built-in proc rule switched off", () => {
    it("leaves the other rules of its spell: Exorcism on a demon, not on an undead", () => {
        const saved = { disabledProcRules: { [`${EXORCISM.id}:targetType:${UNDEAD}`]: true } };
        const onUndead = createPaladin(saved, (world) => targetEnemy(world.state, { yards: 20, creatureTypeId: UNDEAD }));
        expect(onUndead.glowsOn(2)).toBe(0);
        const onDemon = createPaladin(saved, (world) => targetEnemy(world.state, { yards: 20, creatureTypeId: DEMON }));
        expect(onDemon.glowsOn(2)).toBe(1);
    });
});

describe("Revenge by the proc rules", () => {
    function createWarrior(saved: Record<string, unknown>): World {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                learnSpell(state, REVENGE);
                state.bars[1] = REVENGE.id;
                state.unusableSpells[REVENGE.id] = true;
                state.isInCombat = true;
            },
            { shouldUseProcRules: true, ...saved },
        );
        world.advance(1);
        return world;
    }

    it("tells a block, a dodge and a parry apart: a dodge alone can have a group of its own", () => {
        const saved = {
            disabledProcRules: { "6572:afterDodge": true },
            procRules: [{ spellId: REVENGE.id, kind: "afterDodge", result: "glow", priority: 1, group: "dodge" }],
            spellStyles: { "proc:Revenge (dodge)": { glowPercent: 40 } },
        };
        const dodged = createWarrior(saved);
        dodged.fire("UNIT_COMBAT", "player", "DODGE", "", 0, 1);
        dodged.advance(0.5);
        expect(dodged.glowAlphasOn(1)).toEqual([0.4]);
        const blocked = createWarrior(saved);
        blocked.fire("UNIT_COMBAT", "player", "BLOCK", "", 0, 1);
        blocked.advance(0.5);
        expect(blocked.glowAlphasOn(1)).toEqual([1]);
    });
});
