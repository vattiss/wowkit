// A switch of specs (or a reset of the talents) takes spells away: a priest's Shadowform after a switch to Discipline. The
// learned spells are read again in full once the talents settle, rate limited, so a spell of the other spec is not asked for.
import { createWorld, describe, expect, it, playAs, PRIEST, type SpellDefinition, type World } from "@wowkit/test-kit";

const SHADOWFORM: SpellDefinition = { id: 15473, name: "Shadowform", rank: 1, icon: 136200, isHelpful: true };
const TOLD = "Missing buff (not on your action bars): Shadowform";

/** A priest of the Shadow spec, Shadowform learned: on button 1, or on none with its message repeating every second. */
function createShadowPriest(isOnBar: boolean): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            state.spells[SHADOWFORM.id] = SHADOWFORM;
            state.knownSpells[SHADOWFORM.id] = true;
            if (isOnBar) state.bars[1] = SHADOWFORM.id;
        },
        { styles: { missingBuff: { isMessageOn: true, repeat: 1 } } },
    );
    world.advance(2);
    return world;
}

const isTold = (world: World) => (world.notice() ?? "").includes(TOLD);

/** The other spec's talents: Shadowform learned or not, and the client says the talents changed. */
function switchSpec(world: World, isShadow: boolean, event = "ACTIVE_TALENT_GROUP_CHANGED"): void {
    world.state.knownSpells[SHADOWFORM.id] = isShadow ? true : undefined;
    world.fire(event);
}

describe("a priest who switches specs", () => {
    it("sees Shadowform glow no more once in the Discipline spec, and again back in Shadow", () => {
        const world = createShadowPriest(true);
        expect(world.glowsOn(1)).toBe(1);
        switchSpec(world, false);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
        switchSpec(world, true);
        world.advance(8);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is no more told Shadowform is not on the bars once in the Discipline spec", () => {
        const world = createShadowPriest(false);
        expect(isTold(world)).toBe(true);
        switchSpec(world, false);
        // The message shown last stays its time (10 seconds), then does not come again
        world.advance(12);
        expect(isTold(world)).toBe(false);
    });

    for (const event of ["PLAYER_TALENT_UPDATE", "CHARACTER_POINTS_CHANGED"]) {
        it(`sees it glow no more once the talents are reset at the trainer (${event})`, () => {
            const world = createShadowPriest(true);
            switchSpec(world, false, event);
            world.advance(3);
            expect(world.glowsOn(1)).toBe(0);
        });
    }

    it("reads the spells again at most once in a while, a change meanwhile at the end of the wait", () => {
        const world = createShadowPriest(true);
        switchSpec(world, false);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
        // Back to Shadow at once: the spells were read a moment ago, so not yet
        switchSpec(world, true);
        world.advance(1.5);
        expect(world.glowsOn(1)).toBe(0);
        world.advance(5);
        expect(world.glowsOn(1)).toBe(1);
    });
});
