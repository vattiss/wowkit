import { beforeEach, describe, expect, it, learnSpell, playAs, createWorld, type World, BATTLE_SHOUT, WARRIOR } from "@wowkit/test-kit";

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

describe("a warrior with Battle Shout running out in a fight", () => {
    it("sees Battle Shout glow a few seconds before it runs out, not only once it is gone", () => {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, BATTLE_SHOUT);
            state.bars[1] = BATTLE_SHOUT.id;
            state.isInCombat = true;
        });
        world.state.auras.push(world.makeAura(BATTLE_SHOUT.name, BATTLE_SHOUT.id, 10));
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        // 2 seconds left
        world.advance(7);
        expect(world.glowsOn(1)).toBe(1);
    });
});
