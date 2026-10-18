// The shaman's totem cue, the druid's form list, the AoE list.
import {
    beforeEach,
    createWorld,
    describe,
    DRUID,
    expect,
    it,
    learnSpell,
    playAs,
    SHAMAN,
    targetEnemy,
    TOTEM_BAR_FIRST_SLOT,
    WARRIOR,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const attack = (id: number, name: string, extra: Partial<SpellDefinition> = {}): SpellDefinition => ({
    id,
    name,
    rank: 1,
    icon: id,
    maxRange: 0,
    isHarmful: true,
    ...extra,
});

const SEARING_TOTEM: SpellDefinition = { id: 3599, name: "Searing Totem", rank: 1, icon: 3599 };
const LIGHTNING_BOLT = attack(403, "Lightning Bolt", { maxRange: 30, castTimeMs: 1500 });
const WRATH = attack(5176, "Wrath", { maxRange: 30, castTimeMs: 1500 });
const CLAW = attack(1082, "Claw");
const HEROIC_STRIKE = attack(78, "Heroic Strike");
const CLEAVE = attack(845, "Cleave");

/** Puts the spells on buttons 1, 2... */
function putOnBars(state: ClientState, spells: SpellDefinition[]): void {
    spells.forEach((spell, index) => {
        learnSpell(state, spell);
        state.bars[index + 1] = spell.id;
    });
}

describe("a shaman with Searing Totem in the totem bar", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, SHAMAN);
            putOnBars(state, [SEARING_TOTEM, LIGHTNING_BOLT]);
            state.bars[TOTEM_BAR_FIRST_SLOT] = SEARING_TOTEM.id;
            targetEnemy(state);
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("lights the totem next to the rotation while it is not standing", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("stops once the totem stands", () => {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", SEARING_TOTEM.id);
        const now = world.makeAura("now", 0, 0).expirationTime;
        world.state.totems[1] = { name: SEARING_TOTEM.name, start: now, duration: 30 };
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
    });
});

describe("a druid in melee", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, DRUID);
            putOnBars(state, [WRATH, CLAW]);
            targetEnemy(state, { yards: 3 });
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("casts Wrath in caster form", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("follows the cat list in Cat Form", () => {
        world.state.auras.push(world.makeAura("Cat Form", 768, 9999));
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a warrior against several enemies", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, WARRIOR);
            putOnBars(state, [HEROIC_STRIKE, CLEAVE]);
            targetEnemy(state, { yards: 3 });
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("uses the single target list against one enemy", () => {
        world.state.nameplates = 1;
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("switches to the AoE list once three enemies fight the warrior", () => {
        world.state.nameplates = 3;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});
