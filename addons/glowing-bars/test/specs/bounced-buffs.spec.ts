// A buff a stronger one keeps out (issue #68): the camp's Lodestone (+20 attack power) refuses a low Blessing of Might, and
// the game says "A more powerful spell is already active". Its reminder stays quiet until a buff on the player is gone.
import { createWorld, describe, expect, it, learnSpell, PALADIN, playAs, type SpellDefinition, type World } from "@wowkit/test-kit";

const MIGHT: SpellDefinition = { id: 19740, name: "Blessing of Might", rank: 1, icon: 135906, isHelpful: true };
const LODESTONE = { name: "Lodestone", spellId: 1250000, expirationTime: 0 };
const BOUNCED_TEXT = "A more powerful spell is already active";

/** A paladin with Blessing of Might on button 1, missing it, and the Lodestone's buff on them. */
function createPaladin(): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        learnSpell(state, MIGHT);
        state.bars[1] = MIGHT.id;
        state.auras.push({ ...LODESTONE });
    });
    world.advance(1);
    return world;
}

/** The player casts Blessing of Might (at this target: none is themselves), and the game refuses it with this error. */
function castRefused(world: World, message = BOUNCED_TEXT, target = "", spellId = MIGHT.id): void {
    world.fire("UNIT_SPELLCAST_SENT", "player", target, "cast-1", spellId);
    world.fire("UNIT_SPELLCAST_FAILED", "player", "cast-1", spellId);
    world.fire("UI_ERROR_MESSAGE", 0, message);
    world.advance(1);
}

describe("a buff the game refuses for a stronger one of its kind (issue #68)", () => {
    it("stops glowing once the game says a more powerful spell is already active", () => {
        const world = createPaladin();
        expect(world.glowsOn(1)).toBe(1);
        castRefused(world);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("glows again once a buff on the player is gone: the stronger one may have been it", () => {
        const world = createPaladin();
        castRefused(world);
        world.state.auras = [];
        world.fire("UNIT_AURA", "player");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("stays quiet in a fight, while the game hides the auras", () => {
        const world = createPaladin();
        castRefused(world);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("counts a refusal at the player's own name, but not one at another player: it says nothing of the player's buffs", () => {
        const own = createPaladin();
        castRefused(own, BOUNCED_TEXT, "Me");
        expect(own.glowsOn(1)).toBe(0);
        const other = createPaladin();
        castRefused(other, BOUNCED_TEXT, "Tank");
        expect(other.glowsOn(1)).toBe(1);
    });

    it("stays quiet when a short buff runs out: only a long one can be the stronger one", () => {
        const world = createPaladin();
        world.state.auras.push(world.makeAura("Clearcasting", 12536, 10));
        castRefused(world);
        world.state.auras = world.state.auras.filter((aura) => aura.name !== "Clearcasting");
        world.fire("UNIT_AURA", "player");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("quiets a missing buff added by hand in the table too", () => {
        const WARD: SpellDefinition = { id: 900001, name: "Test Ward", rank: 1, icon: 1, isHelpful: true };
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, WARD);
                state.bars[2] = WARD.id;
                state.auras.push({ ...LODESTONE });
            },
            { addedSpells: [{ id: WARD.id, reminderType: "missingBuff" }] },
        );
        world.advance(1);
        expect(world.glowsOn(2)).toBe(1);
        castRefused(world, BOUNCED_TEXT, "", WARD.id);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("goes on glowing for any other error, or for this one without a failed cast of its own", () => {
        const other = createPaladin();
        castRefused(other, "Not enough mana");
        expect(other.glowsOn(1)).toBe(1);
        const alone = createPaladin();
        alone.fire("UNIT_SPELLCAST_FAILED", "player", "cast-1", MIGHT.id);
        alone.advance(2);
        alone.fire("UI_ERROR_MESSAGE", 0, BOUNCED_TEXT);
        alone.advance(1);
        expect(alone.glowsOn(1)).toBe(1);
    });
});
