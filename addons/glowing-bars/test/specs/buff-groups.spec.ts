import { createWorld, describe, expect, it, learnSpell, playAs, PALADIN, type SpellDefinition, type World } from "@wowkit/test-kit";
import { switchInTable } from "./table.helpers";

const DEVOTION: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };
const RETRIBUTION: SpellDefinition = { id: 7294, name: "Retribution Aura", rank: 1, icon: 135873, isHelpful: true };
const CONCENTRATION: SpellDefinition = { id: 19746, name: "Concentration Aura", rank: 1, icon: 135933, isHelpful: true };

/** A paladin with no aura up and three auras on the first buttons: Devotion, Retribution, Concentration. */
function createPaladinWorld(talentPoints: number[], savedSettings?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        state.talentPoints = talentPoints;
        [DEVOTION, RETRIBUTION, CONCENTRATION].forEach((aura, index) => {
            learnSpell(state, aura);
            state.bars[index + 1] = aura.id;
        });
    }, savedSettings);
    world.advance(1);
    return world;
}

/** Which of the three auras glow: their buttons, 1 to 3. */
function findGlowingButtons(world: World): number[] {
    return [1, 2, 3].filter((button) => world.glowsOn(button) > 0);
}

describe("a paladin with no aura up", () => {
    it("sees one aura glow: the first of the list, before any talent or cast says otherwise", () => {
        expect(findGlowingButtons(createPaladinWorld([0, 0, 0]))).toEqual([1]);
    });

    it("sees the aura of the main talent tree glow: Holy wants Concentration Aura", () => {
        expect(findGlowingButtons(createPaladinWorld([31, 5, 15]))).toEqual([3]);
    });

    it("sees the aura cast last glow, over the talent tree's, and still after a reload", () => {
        const world = createPaladinWorld([31, 5, 15]);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", RETRIBUTION.id);
        world.advance(1);
        expect(findGlowingButtons(world)).toEqual([2]);
        const lastBuffs = world.getSavedSettings()?.lastBuffs;
        expect(findGlowingButtons(createPaladinWorld([31, 5, 15], { lastBuffs }))).toEqual([2]);
    });

    it("sees the next one glow once the aura cast last is switched off in the table", () => {
        const world = createPaladinWorld([31, 5, 15], { lastBuffs: { [String(DEVOTION.id)]: RETRIBUTION.id } });
        switchInTable(world, RETRIBUTION.name, false);
        world.advance(1);
        // The talent tree's choice comes next
        expect(findGlowingButtons(world)).toEqual([3]);
    });
});
