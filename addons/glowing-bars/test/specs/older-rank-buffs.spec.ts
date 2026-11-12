import { createWorld, describe, DRUID, expect, it, learnSpell, playAs, type SpellDefinition, type World } from "@wowkit/test-kit";

const RANK_1: SpellDefinition = { id: 1126, name: "Mark of the Wild", rank: 1, icon: 136078 };
const RANK_2: SpellDefinition = { id: 5232, name: "Mark of the Wild", rank: 2, icon: 136078 };

/** A druid who knows rank 2, with rank 1 on them, from `sourceUnit` (none: a player the game does not name). */
function createDruid(sourceUnit: string | undefined, saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, DRUID);
        learnSpell(state, RANK_1);
        learnSpell(state, RANK_2);
    }, saved);
    world.state.auras.push(world.makeAura(RANK_1.name, RANK_1.id, 1800, sourceUnit));
    world.advance(2);
    return world;
}

function countNotes(world: World): number {
    return world.chat.filter((line) => line.includes("the highest you know")).length;
}

describe("a buff on the player at an older rank than the player knows", () => {
    it("is told once in the chat, and again only when it is put on again", () => {
        const world = createDruid("player");
        expect(
            world.chat.filter((line) =>
                line.includes("the Mark of the Wild buff on you is Rank 1. Cast Rank 2 instead, the highest you know."),
            ).length,
        ).toBe(1);
        world.advance(30);
        expect(countNotes(world)).toBe(1);
        // Cast again at the old rank: a new end
        world.state.auras = [world.makeAura(RANK_1.name, RANK_1.id, 1800, "player")];
        world.advance(2);
        expect(countNotes(world)).toBe(2);
    });

    it("is told again for a buff without an end once it was gone, and not after a fight it stayed through", () => {
        const world = createWorld((state) => {
            playAs(state, DRUID);
            learnSpell(state, RANK_1);
            learnSpell(state, RANK_2);
        });
        // No end, as an Aspect
        world.state.auras.push({ ...world.makeAura(RANK_1.name, RANK_1.id, 0, "player"), expirationTime: 0 });
        world.advance(2);
        expect(countNotes(world)).toBe(1);
        world.state.isInCombat = true;
        world.advance(5);
        world.state.isInCombat = false;
        world.advance(5);
        expect(countNotes(world)).toBe(1);
        world.state.auras = [];
        world.advance(2);
        world.state.auras.push({ ...world.makeAura(RANK_1.name, RANK_1.id, 0, "player"), expirationTime: 0 });
        world.advance(2);
        expect(countNotes(world)).toBe(2);
    });

    it("is told for a buff from another player too, in words of its own", () => {
        const world = createDruid(undefined);
        expect(world.chat.filter((line) => line.includes("from another player, is Rank 1. Cast your Rank 2 instead")).length).toBe(1);
    });

    it("says nothing for the newest rank", () => {
        const world = createWorld((state) => {
            playAs(state, DRUID);
            learnSpell(state, RANK_1);
            learnSpell(state, RANK_2);
        });
        world.state.auras.push(world.makeAura(RANK_2.name, RANK_2.id, 1800, "player"));
        world.advance(2);
        expect(countNotes(world)).toBe(0);
    });

    it("says nothing in a fight, and nothing when its switch is off", () => {
        const inFight = createWorld((state) => {
            playAs(state, DRUID);
            learnSpell(state, RANK_1);
            learnSpell(state, RANK_2);
            state.isInCombat = true;
        });
        inFight.state.auras.push(inFight.makeAura(RANK_1.name, RANK_1.id, 1800, "player"));
        inFight.advance(2);
        expect(countNotes(inFight)).toBe(0);
        expect(countNotes(createDruid("player", { shouldNoteOwnOlderRankBuffs: false }))).toBe(0);
        expect(countNotes(createDruid(undefined, { shouldNoteOthersOlderRankBuffs: false }))).toBe(0);
    });
});
