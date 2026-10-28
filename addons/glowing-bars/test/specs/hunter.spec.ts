import {
    beforeEach,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    createWorld,
    type World,
    ASPECT_OF_THE_HAWK,
    ASPECT_OF_THE_MONKEY,
    ASPECT_OF_THE_WILD,
    HUNTER,
    type SpellDefinition,
} from "@wowkit/test-kit";

describe("a hunter with three aspects on the bars", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, HUNTER);
            for (const aspect of [ASPECT_OF_THE_HAWK, ASPECT_OF_THE_MONKEY, ASPECT_OF_THE_WILD]) learnSpell(state, aspect);
            state.bars[1] = ASPECT_OF_THE_HAWK.id;
            state.bars[2] = ASPECT_OF_THE_MONKEY.id;
            state.bars[3] = ASPECT_OF_THE_WILD.id;
        });
    });

    // One aspect is enough, so only the first one is asked for
    it("sees only the first aspect glow", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(3)).toBe(0);
    });
});

describe("a hunter who knows two ranks of Aspect of the Hawk", () => {
    const HAWK_RANK_2: SpellDefinition = { ...ASPECT_OF_THE_HAWK, id: 14318, rank: 2 };
    let world!: World;

    function cast(spellId: number): void {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", spellId);
        world.advance(1);
    }

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, HUNTER);
            for (const aspect of [ASPECT_OF_THE_HAWK, HAWK_RANK_2, ASPECT_OF_THE_MONKEY]) learnSpell(state, aspect);
            state.bars[1] = HAWK_RANK_2.id;
            state.bars[2] = ASPECT_OF_THE_MONKEY.id;
        });
        world.advance(1);
    });

    it("sees the Hawk glow again after casting its higher rank, though the Monkey was cast before", () => {
        cast(ASPECT_OF_THE_MONKEY.id);
        expect(world.glowsOn(2)).toBe(1);
        cast(HAWK_RANK_2.id);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });
});
