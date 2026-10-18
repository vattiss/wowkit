// The warrior and the rogue: the opener, the interrupt, the defense at low health, the finisher, from behind.
import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    ROGUE,
    targetEnemy,
    WARRIOR,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const melee = (id: number, name: string, extra: Partial<SpellDefinition> = {}): SpellDefinition => ({
    id,
    name,
    rank: 1,
    icon: id,
    maxRange: 0,
    isHarmful: true,
    ...extra,
});

const CHARGE = melee(100, "Charge", { maxRange: 25 });
const REND = melee(772, "Rend");
const HEROIC_STRIKE = melee(78, "Heroic Strike");
const PUMMEL = melee(6552, "Pummel", { cooldownSeconds: 10 });
const SHIELD_WALL: SpellDefinition = { id: 871, name: "Shield Wall", rank: 1, icon: 871, cooldownSeconds: 1800 };
const SINISTER_STRIKE = melee(1752, "Sinister Strike");
const EVISCERATE = melee(2098, "Eviscerate");
const BACKSTAB = melee(53, "Backstab");

/** A warrior with Charge, Rend, Heroic Strike, Pummel and Shield Wall on buttons 1-5, an enemy at 20 yards. */
function setUpWarrior(state: ClientState): void {
    playAs(state, WARRIOR);
    [CHARGE, REND, HEROIC_STRIKE, PUMMEL, SHIELD_WALL].forEach((spell, index) => {
        learnSpell(state, spell);
        state.bars[index + 1] = spell.id;
    });
    targetEnemy(state, { yards: 20 });
}

describe("a warrior", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpWarrior);
        world.advance(1);
    });

    it("charges an enemy at range out of combat", () => {
        expect(world.glowsOn(1)).toBe(1);
    });

    it("keeps Rend up in melee, then fills with Heroic Strike", () => {
        world.state.isInCombat = true;
        world.state.target!.yards = 3;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", REND.id);
        world.state.target!.debuffs.push(world.makeAura(REND.name, REND.id, 9, "player"));
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(3)).toBe(1);
    });

    it("lights Pummel while the target casts, not when the cast cannot be interrupted", () => {
        world.state.isInCombat = true;
        world.state.target!.yards = 3;
        world.state.target!.castingSpell = "Fireball";
        world.advance(0.5);
        expect(world.glowsOn(4)).toBe(1);
        world.state.target!.isCastShielded = true;
        world.advance(0.5);
        expect(world.glowsOn(4)).toBe(0);
    });

    it("lights Shield Wall at low health in combat", () => {
        world.state.isInCombat = true;
        world.state.health = 20;
        world.advance(0.5);
        expect(world.glowsOn(5)).toBe(1);
    });
});

/** A rogue with Sinister Strike, Eviscerate and Backstab on buttons 1-3, an enemy in melee that attacks the rogue. */
function setUpRogue(state: ClientState): void {
    playAs(state, ROGUE);
    [SINISTER_STRIKE, EVISCERATE, BACKSTAB].forEach((spell, index) => {
        learnSpell(state, spell);
        state.bars[index + 1] = spell.id;
    });
    targetEnemy(state, { yards: 3, isAttackingPlayer: true });
    state.isInCombat = true;
}

describe("a rogue", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpRogue);
        world.advance(1);
    });

    it("builds combo points with Sinister Strike while the target faces the rogue", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(3)).toBe(0);
    });

    it("finishes with Eviscerate at 5 combo points", () => {
        world.state.comboPoints = 5;
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("backstabs from behind, when the target attacks someone else", () => {
        world.state.target!.isAttackingPlayer = false;
        world.advance(0.5);
        expect(world.glowsOn(3)).toBe(1);
    });
});
