// Soul Link, the warlock's talent (issue #63): a buff with no end, cast again for each demon summoned. It glows when it is
// missing with a living demon out: without one it cannot be cast, though the client may call it usable.
import { createWorld, describe, expect, it, learnSpell, playAs, type SpellDefinition, type World } from "@wowkit/test-kit";

const WARLOCK = { name: "Warlock", token: "WARLOCK", id: 9 };
const SOUL_LINK: SpellDefinition = { id: 19028, name: "Soul Link", rank: 1, icon: 136160, isHelpful: true };

/** A warlock with Soul Link on button 1; `hasDemon`: a demon is out. */
function createWarlock(hasDemon: boolean, isLinked: boolean): World {
    const world = createWorld((state) => {
        playAs(state, WARLOCK);
        learnSpell(state, SOUL_LINK);
        state.bars[1] = SOUL_LINK.id;
        if (hasDemon) state.pet = {};
        if (isLinked) state.auras.push({ name: SOUL_LINK.name, spellId: SOUL_LINK.id, expirationTime: 0, sourceUnit: "player" });
    });
    world.advance(1);
    return world;
}

describe("Soul Link, a warlock's buff cast again for each demon", () => {
    it("glows when it is missing with a demon out: a new demon was summoned", () => {
        expect(createWarlock(true, false).glowsOn(1)).toBe(1);
    });

    it("does not glow without a demon: it cannot be cast, though the client calls it usable", () => {
        expect(createWarlock(false, false).glowsOn(1)).toBe(0);
    });

    it("does not glow while the demon is dead", () => {
        const world = createWarlock(true, false);
        world.state.pet = { isDead: true };
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes out at once when the demon is dismissed", () => {
        const world = createWarlock(true, false);
        world.state.pet = undefined;
        world.fire("UNIT_PET", "player");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("does not glow while it is on", () => {
        expect(createWarlock(true, true).glowsOn(1)).toBe(0);
    });

    it("glows once the demon is summoned again", () => {
        const world = createWarlock(false, false);
        world.state.pet = {};
        world.fire("UNIT_PET", "player");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("Soul Link in a fight, while the game hides the auras", () => {
    function startFight(world: World): void {
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
    }

    it("stays dark when it was cast before the fight", () => {
        const world = createWarlock(true, true);
        startFight(world);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes out once it is cast in the fight", () => {
        const world = createWarlock(true, false);
        startFight(world);
        expect(world.glowsOn(1)).toBe(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", SOUL_LINK.id);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});
