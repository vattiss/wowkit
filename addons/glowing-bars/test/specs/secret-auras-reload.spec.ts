// The buff memory through a /reload (issue #88): in a dungeon the game keeps some buffs secret, and what was seen of them
// before is all there is to go by. A reload keeps it; a login (the buffs' times stood still meanwhile), an old save, or one
// the file got wrong, does not.
import {
    BLESSING_OF_KINGS,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    reloadWorld,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { createPlayer, enterDungeon, putOn, runOut, WARD } from "./secret-auras.helpers";

const BLESSING_OF_MIGHT: SpellDefinition = { id: 19740, name: "Blessing of Might", rank: 1, icon: 135906, isHelpful: true };

/** The addon logs out and loads again `seconds` later (a login, or a /reload), with what it saved and the game as it was. */
function startAgain(world: World, seconds: number, isReload: boolean): World {
    world.fire("PLAYER_LOGOUT");
    const saved = world.getSavedSettings() ?? {};
    const old = world.state;
    return createWorld((state) => Object.assign(state, old), saved, { startAt: GetTime() + seconds, isReload });
}

/** A priest whose added buff was seen with 60 seconds left, then in a dungeon where it is kept secret, 20 seconds on. */
function createInDungeon(): World {
    const world = createPlayer(WARD);
    putOn(world, WARD, 60);
    enterDungeon(world);
    world.advance(20);
    return world;
}

/** A priest whose added buff was seen gone, then in a dungeon where it is kept secret: asked for there. */
function createGoneInDungeon(): World {
    const world = createPlayer(WARD);
    enterDungeon(world);
    return world;
}

describe("a buff kept secret, through a /reload in the dungeon", () => {
    it("is followed to the end seen before the reload: not asked for while up, asked for once it runs out", () => {
        const world = reloadWorld(createInDungeon());
        world.advance(10);
        expect(world.glowsOn(1)).toBe(0);
        runOut(world, WARD, 30);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is taken back when it was gone before the reload: asked for", () => {
        expect(startAgain(createGoneInDungeon(), 1, true).glowsOn(1)).toBe(1);
    });

    it("is not taken back after a login, a moment later too: the buffs' times stood still while away", () => {
        expect(startAgain(createGoneInDungeon(), 1, false).glowsOn(1)).toBe(0);
    });

    it("is not taken back from a save long ago", () => {
        expect(startAgain(createGoneInDungeon(), 400, true).glowsOn(1)).toBe(0);
    });

    it("is not taken back when the game's clock started again lower (the computer restarted)", () => {
        expect(startAgain(createGoneInDungeon(), -500, true).glowsOn(1)).toBe(0);
    });
});

describe("a paladin's own blessing, through a /reload in the dungeon, with another paladin's on them", () => {
    it("is still asked for when it was gone before the reload: another's Kings is no blessing of theirs", () => {
        const world = createWorld((state) => {
            playAs(state, { name: "Paladin", token: "PALADIN", id: 2 });
            learnSpell(state, BLESSING_OF_MIGHT);
            learnSpell(state, BLESSING_OF_KINGS);
            state.bars[1] = BLESSING_OF_MIGHT.id;
            state.auraSecrecy.hiddenSpells[BLESSING_OF_MIGHT.id] = true;
        });
        world.state.auras.push({ name: "Other Aura", spellId: 99001, expirationTime: 1e9 });
        world.state.auras.push({ name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1e9, sourceUnit: "party1" });
        world.advance(1);
        enterDungeon(world);
        const reloaded = reloadWorld(world);
        reloaded.state.isInCombat = true;
        reloaded.fire("PLAYER_REGEN_DISABLED");
        reloaded.advance(1);
        expect(reloaded.glowsOn(1)).toBe(1);
    });
});

describe("a buff memory the saved file got wrong", () => {
    it("is dropped, and the addon loads all the same", () => {
        for (const buffMemory of [{ savedAt: "now" }, { savedAt: GetTime(), memory: { held: { ward: "soon" } } }, "broken"]) {
            const world = createPlayer(WARD, { saved: { buffMemory } });
            putOn(world, WARD, 60);
            expect(world.glowsOn(1)).toBe(0);
        }
    });
});
