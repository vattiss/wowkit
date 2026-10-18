// The hunter's shot cue, the priest's filler that yields, the priest's purge.
import {
    beforeEach,
    createWorld,
    describe,
    expect,
    HUNTER,
    it,
    learnSpell,
    playAs,
    PRIEST,
    targetEnemy,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const ranged = (id: number, name: string, extra: Partial<SpellDefinition> = {}): SpellDefinition => ({
    id,
    name,
    rank: 1,
    icon: id,
    maxRange: 35,
    isHarmful: true,
    ...extra,
});

const AUTO_SHOT = ranged(75, "Auto Shot");
const SERPENT_STING = ranged(1978, "Serpent Sting");
const RAPTOR_STRIKE = ranged(2973, "Raptor Strike", { maxRange: 0 });
const MIND_FLAY = ranged(15407, "Mind Flay", { maxRange: 20 });
const HOLY_FIRE = ranged(14914, "Holy Fire", { maxRange: 30, castTimeMs: 3500 });
const SMITE = ranged(585, "Smite", { maxRange: 30, castTimeMs: 1500 });
const DISPEL_MAGIC = ranged(527, "Dispel Magic", { maxRange: 30, isHelpful: true });

describe("a hunter", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state: ClientState) => {
            playAs(state, HUNTER);
            [AUTO_SHOT, SERPENT_STING, RAPTOR_STRIKE].forEach((spell, index) => {
                learnSpell(state, spell);
                state.bars[index + 1] = spell.id;
            });
            targetEnemy(state);
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("lights Auto Shot next to the rotation at range", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("switches to melee in melee range, where Auto Shot cannot be used", () => {
        world.state.target!.yards = 3;
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(3)).toBe(1);
    });
});

describe("a priest with Mind Flay listed before Holy Fire", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state: ClientState) => {
            playAs(state, PRIEST);
            [MIND_FLAY, HOLY_FIRE].forEach((spell, index) => {
                learnSpell(state, spell);
                state.bars[index + 1] = spell.id;
            });
            targetEnemy(state, { yards: 15 });
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("lets the filler yield to the DoT that is ready", () => {
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a priest against a buffed enemy", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state: ClientState) => {
            playAs(state, PRIEST);
            [SMITE, DISPEL_MAGIC].forEach((spell, index) => {
                learnSpell(state, spell);
                state.bars[index + 1] = spell.id;
            });
            targetEnemy(state);
            state.isInCombat = true;
        });
        world.advance(1);
    });

    it("lights Dispel Magic when the target has a magic buff", () => {
        expect(world.glowsOn(2)).toBe(0);
        world.state.target!.buffs.push({ ...world.makeAura("Arcane Intellect", 1459, 600), dispelName: "Magic" });
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
    });
});
