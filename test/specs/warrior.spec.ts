import { beforeEach, describe, expect, it } from "../framework";
import { learnSpell, playAs } from "../world/client-state";
import { createWorld, type World } from "../world/world";
import { BATTLE_SHOUT, WARRIOR } from "./fixtures";

describe("a warrior without rage", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, BATTLE_SHOUT);
            state.bars[1] = BATTLE_SHOUT.id;
            state.unusableSpells[BATTLE_SHOUT.id] = true;
        });
    });

    it("sees no glow on Battle Shout, which cannot be cast yet", () => {
        expect(world.glowsOn(1)).toBe(0);
    });

    it("is not told that Battle Shout is missing from the bars, because it is on one", () => {
        expect(world.notice()).not.toContain("Battle Shout");
    });

    it("sees the glow as soon as there is enough rage", () => {
        world.state.isInCombat = true;
        world.state.unusableSpells[BATTLE_SHOUT.id] = undefined;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });
});
