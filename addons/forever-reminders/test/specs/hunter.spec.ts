import { beforeEach, describe, expect, it } from "@forever/test-kit";
import { learnSpell, playAs } from "@forever/test-kit";
import { createWorld, type World } from "@forever/test-kit";
import { ASPECT_OF_THE_HAWK, ASPECT_OF_THE_MONKEY, ASPECT_OF_THE_WILD, HUNTER } from "./fixtures";

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
