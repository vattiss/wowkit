// The targeted Whens of a reminder: an enemy or anyone living targeted (or a fight: a target lost in one does not turn them
// off), or a living ally (the player too), by the target alone.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    targetEnemy,
    FORTITUDE,
    PRIEST,
    type ClientState,
    type World,
} from "@wowkit/test-kit";

/** A priest missing Fortitude, which sits on button 1, with these settings. */
function startPriest(savedSettings?: Record<string, unknown>, setUp?: (state: ClientState) => void): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        learnSpell(state, FORTITUDE);
        state.bars[1] = FORTITUDE.id;
        setUp?.(state);
    }, savedSettings);
    world.advance(1);
    return world;
}

describe("a missing buff that shows only with an enemy targeted, or in a fight", () => {
    const settings = { styles: { missingBuff: { when: "enemyTargeted" } } };

    it("does not glow with no target out of combat", () => {
        expect(startPriest(settings).glowsOn(1)).toBe(0);
    });

    it("glows in a fight with no target, and stays lit as the target is lost in it", () => {
        expect(startPriest(settings, (state) => (state.isInCombat = true)).glowsOn(1)).toBe(1);
        const world = startPriest(settings, (state) => {
            state.isInCombat = true;
            targetEnemy(state);
        });
        world.state.target = undefined;
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("glows as soon as the player targets an enemy, out of combat too", () => {
        const world = startPriest(settings);
        targetEnemy(world.state);
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("does not glow on a dead enemy, nor on a friend", () => {
        expect(startPriest(settings, (state) => targetEnemy(state, { isDead: true })).glowsOn(1)).toBe(0);
        expect(startPriest(settings, (state) => targetEnemy(state, { isEnemy: false })).glowsOn(1)).toBe(0);
    });

    it("goes out when the target is cleared out of combat", () => {
        const world = startPriest(settings, (state) => targetEnemy(state));
        expect(world.glowsOn(1)).toBe(1);
        world.state.target = undefined;
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a missing buff that shows only with an ally targeted", () => {
    const settings = { styles: { missingBuff: { when: "allyTargeted" } } };

    it("glows with a living ally targeted, the player too, and goes out when the target is cleared", () => {
        const world = startPriest(settings, (state) => targetEnemy(state, { isEnemy: false, name: "Me" }));
        expect(world.glowsOn(1)).toBe(1);
        world.state.target = undefined;
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(0.1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("does not glow with no target, on an enemy, nor on a dead ally", () => {
        expect(startPriest(settings, (state) => (state.isInCombat = true)).glowsOn(1)).toBe(0);
        expect(startPriest(settings, (state) => targetEnemy(state)).glowsOn(1)).toBe(0);
        expect(startPriest(settings, (state) => targetEnemy(state, { isEnemy: false, isDead: true })).glowsOn(1)).toBe(0);
    });
});

describe("a missing buff that shows only with anyone targeted, or in a fight", () => {
    const settings = { styles: { missingBuff: { when: "anyTargeted" } } };

    it("glows with a living enemy or ally targeted", () => {
        expect(startPriest(settings, (state) => targetEnemy(state)).glowsOn(1)).toBe(1);
        expect(startPriest(settings, (state) => targetEnemy(state, { isEnemy: false })).glowsOn(1)).toBe(1);
    });

    it("glows in a fight with no target", () => {
        expect(startPriest(settings, (state) => (state.isInCombat = true)).glowsOn(1)).toBe(1);
    });

    it("does not glow with no target out of combat, nor on a dead one", () => {
        expect(startPriest(settings).glowsOn(1)).toBe(0);
        expect(startPriest(settings, (state) => targetEnemy(state, { isDead: true })).glowsOn(1)).toBe(0);
    });
});
