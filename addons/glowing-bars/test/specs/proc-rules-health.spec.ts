// The proc rules on the health and in a fight (beta): the addon's rules on the health switched off, the player's own rules
// on the health (a faded glow with a row of its own), a buff of the player's rule told by the addon's memory while the game
// hides it, and the Cooldown Manager asked to track the buffs of the player's rules.
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
import { findRow, showTab, toggleTable } from "./table.helpers";

const EXECUTE: SpellDefinition = { id: 5308, name: "Execute", rank: 1, icon: 135358, maxRange: 5, isHarmful: true };
const DEFENSIVE_STANCE: SpellDefinition = { id: 71, name: "Defensive Stance", rank: 0, icon: 132341, isHelpful: true };
const HOLY_LIGHT: SpellDefinition = { id: 635, name: "Holy Light", rank: 1, icon: 135920, isHelpful: true };
const HOLY_STRIKE: SpellDefinition = { id: 407676, name: "Holy Strike", rank: 1, icon: 135891, isHarmful: true };
const HOLY_SHIELD = 20925;
const TRACKED_BUFF = 2;
const SPEC = 1;

describe("the addon's rule on the health of Execute in Defensive Stance", () => {
    function createWarrior(saved: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, EXECUTE);
            state.spells[DEFENSIVE_STANCE.id] = DEFENSIVE_STANCE;
            state.bars[1] = EXECUTE.id;
            state.unusableSpells[EXECUTE.id] = true;
            state.stances = [2457, DEFENSIVE_STANCE.id];
            state.activeStance = DEFENSIVE_STANCE.id;
            state.isInCombat = true;
            targetEnemy(state, { health: 15 });
        }, saved);
        world.advance(1);
        return world;
    }

    it("is switched off on the Proc rules tab, with the rules on only", () => {
        const off = { disabledProcRules: { [`${EXECUTE.id}:targetHealth:20`]: true } };
        expect(createWarrior({ shouldUseProcRules: true, ...off }).glowAlphasOn(1)).toEqual([]);
        expect(createWarrior({ shouldUseProcRules: false, ...off }).glowAlphasOn(1)).toEqual([1]);
    });
});

describe("a rule of the player's on the health", () => {
    const RULE = { spellId: HOLY_LIGHT.id, kind: "myHealth", value: 35, result: "glow", priority: 1, group: "my health <= 35%" };

    function createPaladin(health: number, saved: Record<string, unknown> = {}): World {
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, HOLY_LIGHT);
                state.bars[1] = HOLY_LIGHT.id;
                state.health = health;
            },
            { shouldUseProcRules: true, procRules: [RULE], ...saved },
        );
        world.advance(1);
        return world;
    }

    it("lights its spell faded by the health, shown below its percent", () => {
        expect(createPaladin(30).glowAlphasOn(1)).toEqual([1]);
        expect(createPaladin(80).glowAlphasOn(1)).toEqual([0]);
    });

    it("lights nothing while the rules are off", () => {
        expect(createPaladin(30, { shouldUseProcRules: false }).glowAlphasOn(1)).toEqual([]);
    });

    it("has a row of its own on the Procs tab, where what it cannot do is faded", () => {
        const world = createPaladin(30);
        toggleTable();
        showTab(world, "Procs");
        const row = findRow(world, "Holy Light (my health <= 35%)");
        expect(row.sound.alpha < 1).toBe(true);
    });
});

describe("a buff of the player's rule in a fight", () => {
    const RULE = { spellId: HOLY_STRIKE.id, kind: "buff", value: HOLY_SHIELD, result: "glow", priority: 1 };

    function createPaladin(saved: Record<string, unknown> = {}): World {
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, HOLY_STRIKE);
                state.spells[HOLY_SHIELD] = { id: HOLY_SHIELD, name: "Holy Shield", rank: 1, icon: 135880 };
                state.bars[1] = HOLY_STRIKE.id;
                state.buffCatalog.push({ spellId: HOLY_SHIELD, isHiddenByDefault: true });
            },
            { shouldUseProcRules: true, procRules: [RULE], ...saved },
        );
        world.advance(1);
        return world;
    }

    it("is told by the addon's memory while the game hides the auras", () => {
        const world = createPaladin();
        world.state.auras.push(world.makeAura("Holy Shield", HOLY_SHIELD, 10));
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is tracked by the Cooldown Manager, with full access", () => {
        const world = createPaladin({ isCooldownManagerSetUp: true, cooldownManagerAccess: "full" });
        world.advance(6);
        const saved = world.state.layoutData as {
            2?: Record<number, number>;
            3?: Record<number, Record<number, { 2?: Record<number, number[]> }>>;
        };
        const layout = saved[2]?.[SPEC];
        const tracked = layout !== undefined ? (saved[3]?.[SPEC]?.[layout]?.[2]?.[TRACKED_BUFF] ?? []) : [];
        expect(tracked.includes(HOLY_SHIELD)).toBe(true);
    });
});
