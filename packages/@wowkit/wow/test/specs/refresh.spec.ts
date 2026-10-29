import { Addon } from "@wowkit/core";
import {
    BarRefreshService,
    ButtonRegistryService,
    ClockService,
    SpellRefreshService,
    type ActionBarsService,
    type SpellsService,
} from "@wowkit/wow";
import { beforeEach, createBasicGame, describe, expect, it, type BasicGame } from "@wowkit/test-kit";

/** What BarRefreshService asks of the action bars. */
class StubBars {
    changes = 0;
    maps = 0;
    noteBarsChanged(): void {
        this.changes += 1;
    }
    mapBars(): void {
        this.maps += 1;
    }
}

/** What SpellRefreshService asks of the spells. */
class StubSpells {
    clears = 0;
    learned: (number | undefined)[] = [];
    invalidateSpells(): void {
        this.clears += 1;
    }
    noteLearnedSpell(spellId: number | undefined): void {
        this.learned.push(spellId);
    }
}

describe("the map of the action bars", () => {
    let game!: BasicGame;
    let bars!: StubBars;
    let addon!: Addon;

    beforeEach(() => {
        game = createBasicGame();
        bars = new StubBars();
        addon = new Addon("Test");
        addon.register(new BarRefreshService(bars as unknown as ActionBarsService, new ClockService(), new ButtonRegistryService()));
        addon.start();
        game.frames.fire("PLAYER_LOGIN");
    });

    it("is mapped again once a burst of changes settles, not for each change", () => {
        for (const slot of [1, 2, 3]) game.frames.fire("ACTIONBAR_SLOT_CHANGED", slot);
        game.clock.advance(0.3);
        expect(bars.maps).toBe(0);
        game.clock.advance(0.5);
        expect(bars.maps).toBe(1);
    });

    it("notes every change at once, so a reader knows the map is old", () => {
        for (const slot of [1, 2, 3]) game.frames.fire("ACTIONBAR_SLOT_CHANGED", slot);
        expect(bars.changes).toBe(3);
    });

    it("waits again when more changes come while it waits", () => {
        game.frames.fire("ACTIONBAR_SLOT_CHANGED", 1);
        game.clock.advance(0.4);
        game.frames.fire("ACTIONBAR_PAGE_CHANGED");
        game.clock.advance(0.4);
        expect(bars.maps).toBe(0);
        game.clock.advance(0.3);
        expect(bars.maps).toBe(1);
    });

    it("is mapped again after the spells were refreshed (a new rank may be on a bar)", () => {
        addon.events.emit("spells.refreshed");
        game.clock.advance(0.8);
        expect(bars.maps).toBe(1);
    });
});

describe("the spell lookups", () => {
    let game!: BasicGame;
    let spells!: StubSpells;
    let addon!: Addon;
    let announced!: number;

    beforeEach(() => {
        game = createBasicGame();
        spells = new StubSpells();
        addon = new Addon("Test");
        addon.register(new SpellRefreshService(spells as unknown as SpellsService, new ClockService(), addon.events));
        addon.start();
        announced = 0;
        addon.events.on("spells.refreshed", () => {
            announced += 1;
        });
        game.frames.fire("PLAYER_LOGIN");
    });

    it("are cleared once after a burst of level-ups and learned spells, and announced", () => {
        game.frames.fire("PLAYER_LEVEL_UP");
        game.frames.fire("PLAYER_TALENT_UPDATE");
        game.clock.advance(0.3);
        expect(spells.clears).toBe(0);
        game.clock.advance(0.5);
        expect(spells.clears).toBe(1);
        expect(announced).toBe(1);
    });

    it("note a learned spell at once, and clear the lookups after it", () => {
        game.frames.fire("LEARNED_SPELL_IN_SKILL_LINE", 1243);
        expect(spells.learned).toEqual([1243]);
        game.clock.advance(0.8);
        expect(spells.clears).toBe(1);
    });
});
