// A cooldown ready at the login (a reload) was so before: it did not just come back, and does not glow for it. One running
// at the login glows as it comes back. The first look begins no time either: a reload in a fight is not its start.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    targetEnemy,
    WARRIOR,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 1800 };

function login(when: string, change?: (state: World["state"]) => void): World {
    const world = createWorld(
        (state) => {
            playAs(state, WARRIOR);
            learnSpell(state, RECKLESSNESS);
            state.bars[1] = RECKLESSNESS.id;
            change?.(state);
        },
        { styles: { readyCooldown: { when } } },
    );
    world.advance(1);
    return world;
}

describe("a ready cooldown at the login", () => {
    it("does not glow when it was ready already, with Always or Out of combat", () => {
        expect(login("always").glowsOn(1)).toBe(0);
        expect(login("outOfCombat").glowsOn(1)).toBe(0);
    });

    it("glows as it comes back when it was running at the login", () => {
        const world = login("always", (state) => (state.cooldowns[RECKLESSNESS.id] = { start: GetTime(), duration: 3 }));
        expect(world.glowsOn(1)).toBe(0);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("glows with Until done all the same: it glows while ready", () => {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                learnSpell(state, RECKLESSNESS);
                state.bars[1] = RECKLESSNESS.id;
            },
            { styles: { readyCooldown: { when: "always", glowTime: 0 } } },
        );
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("does not take a reload in a fight for its start, nor a target held then for a new one", () => {
        expect(login("alwaysStart", (state) => (state.isInCombat = true)).glowsOn(1)).toBe(0);
        expect(login("enemyTargeted", (state) => targetEnemy(state)).glowsOn(1)).toBe(0);
    });

    it("glows as the next fight starts with Always + start", () => {
        const world = login("alwaysStart");
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});
