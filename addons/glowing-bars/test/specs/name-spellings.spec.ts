// A localized client may write one name two ways: Plaie d'agonie and Plaie d’agonie (another apostrophe), or a space no
// wider than a letter before a colon. Names are compared by their letters alone (buildNameKey), so the two are one spell.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type FakeFrame, type World } from "@wowkit/test-kit";
import { showTab, switchInTable, toggleTable } from "./table.helpers";

const WARLOCK = { name: "Warlock", token: "WARLOCK", id: 9 };
/** Curse of Agony on a French client: its first rank with a straight apostrophe, its second with a curly one. */
const AGONY_RANK_1 = { id: 980, name: "Plaie d'agonie", rank: 1, icon: 136139, isHarmful: true };
const AGONY_RANK_2 = { id: 1014, name: "Plaie d’agonie", rank: 2, icon: 136139, isHarmful: true };

/** A warlock who knows both ranks, the first on button 1, with these settings. */
function createWarlock(saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, WARLOCK);
        for (const spell of [AGONY_RANK_1, AGONY_RANK_2]) learnSpell(state, spell);
        state.bars[1] = AGONY_RANK_1.id;
    }, saved);
    world.advance(3);
    return world;
}

/** The old rank's glow is the quiet one, at half opacity. */
const hasOldRankGlow = (world: World) => world.glowAlphasOn(1).includes(0.5);

/** The rows of the table that name the curse: its label beside the type (not the message on the screen). */
const listAgonyLabels = (world: World): FakeFrame[] =>
    world.frames.filter(
        (frame) =>
            frame.isShown &&
            frame.fontStrings.some((text) => text.text?.includes("agonie") === true) &&
            frame.fontStrings.some((text) => text.text === "Old rank"),
    );

describe("a name the client writes two ways (Plaie d'agonie, Plaie d’agonie)", () => {
    it("is one spell: its first rank on the bars is an old rank", () => {
        expect(hasOldRankGlow(createWarlock())).toBe(true);
    });

    it("has one row on the Old ranks tab, whose switch turns its old rank glow off", () => {
        const world = createWarlock();
        toggleTable();
        showTab(world, "Old ranks");
        const labels = listAgonyLabels(world);
        expect(labels.length).toBe(1);
        const label = labels[0]!.fontStrings.find((text) => text.text?.includes("agonie") === true)!.text!;
        switchInTable(world, label, false);
        world.advance(2);
        expect(hasOldRankGlow(world)).toBe(false);
    });

    it("is not an old rank with its higher rank on the bars too, however that one is written", () => {
        const world = createWorld((state) => {
            playAs(state, WARLOCK);
            for (const spell of [AGONY_RANK_1, AGONY_RANK_2]) learnSpell(state, spell);
            state.bars[1] = AGONY_RANK_1.id;
            state.bars[2] = AGONY_RANK_2.id;
        });
        world.advance(3);
        expect(hasOldRankGlow(world)).toBe(false);
    });

    it("keeps a switch saved under the other way of writing it", () => {
        expect(hasOldRankGlow(createWarlock({ enabledRanks: { "Plaie d’agonie": false } }))).toBe(false);
    });
});

describe("a buff whose aura the client writes another way than the spell", () => {
    it("is up: its button does not glow", () => {
        const fortitude = { id: 1243, name: "Mot de pouvoir : Robustesse", rank: 1, icon: 135987, isHelpful: true };
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, fortitude);
            state.bars[1] = fortitude.id;
            // A space no wider than a letter before the colon, and another rank's ID: found by its name alone
            state.auras.push({ name: "Mot de pouvoir : Robustesse", spellId: 1244, expirationTime: 1000 + 1800 });
        });
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
    });
});
