import { beforeEach, describe, expect, it, learnSpell, playAs, createWorld, type World } from "@forever/test-kit";
import { FORTITUDE, INNER_FIRE, PRIEST, SMITE_RANK_1, SMITE_RANK_2 } from "./fixtures";

describe("a priest", () => {
    let world!: World;

    // Fortitude is on the first button, Smite rank 1 on the second; Inner Fire is learned but on no bar
    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PRIEST);
            for (const spell of [FORTITUDE, INNER_FIRE, SMITE_RANK_1, SMITE_RANK_2]) learnSpell(state, spell);
            state.bars[1] = FORTITUDE.id;
            state.bars[2] = SMITE_RANK_1.id;
        });
    });

    describe("at login", () => {
        it("greets in the chat", () => {
            expect(world.chat[0]).toContain("Initialized");
        });

        it("keeps its settings in the character's saved variables", () => {
            expect(world.getSavedSettings()?.showBuff).toBe(true);
        });

        it("adds its page to the options", () => {
            expect(world.proxySettings["ForeverReminders_showBuff"]).toBeDefined();
        });
    });

    describe("a missing buff", () => {
        it("glows on its action button", () => {
            expect(world.glowsOn(1)).toBe(1);
        });

        it("leaves the other buttons alone", () => {
            expect(world.glowsOn(2)).toBe(0);
        });

        it("is named when it is on no action bar", () => {
            expect(world.notice()).toContain("not on your action bars: Inner Fire");
        });

        it("makes no sound unless the player picked one", () => {
            expect(world.sounds.length).toBe(0);
        });
    });

    describe("a spell kept at an old rank", () => {
        it("is named with both ranks", () => {
            expect(world.notice()).toContain("Smite: Rank 1 is on your action bar, but you know Rank 2.");
        });

        it("is not named any more once the bar holds the best rank", () => {
            world.state.bars[2] = SMITE_RANK_2.id;
            world.fire("ACTIONBAR_SLOT_CHANGED", 2);
            world.advance(3);
            expect(world.notice()).not.toContain("Smite");
            expect(world.notice()).toContain("Inner Fire");
        });
    });

    describe("once the buff is on the player", () => {
        beforeEach(() => {
            world.state.auras.push(world.makeAura(FORTITUDE.name, FORTITUDE.id, 1800));
            world.fire("UNIT_AURA", "player");
            world.advance(1);
        });

        it("the glow goes out", () => {
            expect(world.glowsOn(1)).toBe(0);
        });

        it("the buff still counts in combat, while the game hides the auras", () => {
            world.state.isInCombat = true;
            world.state.areAurasHidden = true;
            world.advance(1);
            expect(world.glowsOn(1)).toBe(0);
        });
    });

    // In combat the game hides the player's auras; the addon remembers the cast instead
    describe("a buff cast in combat", () => {
        it("counts although the game hides the auras", () => {
            world.state.isInCombat = true;
            world.state.areAurasHidden = true;
            world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", FORTITUDE.id);
            world.advance(1);
            expect(world.glowsOn(1)).toBe(0);
        });
    });

    describe("the switch of a buff in the options", () => {
        it("is saved when the player switches the buff off", () => {
            world.setOption("buff_InnerFire", false);
            const buffOn = world.getSavedSettings()?.buffOn as Record<string, boolean | undefined>;
            expect(buffOn.InnerFire).toBe(false);
        });

        it("is not stored when it is back at its default", () => {
            world.setOption("buff_InnerFire", false);
            world.setOption("buff_InnerFire", true);
            const buffOn = world.getSavedSettings()?.buffOn as Record<string, boolean | undefined>;
            expect(buffOn.InnerFire).toBeUndefined();
        });
    });

    it("stays quiet while resting in town", () => {
        world.state.isResting = true;
        world.fire("PLAYER_UPDATE_RESTING");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});
