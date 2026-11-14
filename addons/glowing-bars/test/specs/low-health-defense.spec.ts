// A paladin's Templar's Bulwark at low health (an idea of sorrow8's fork): lit all the while it is ready, and shown by the
// health the game hides, through a curve, only at 10% or below. It has a row among the procs, but no proc glow of its own.
import { createWorld, describe, expect, it, learnSpell, PALADIN, playAs, type SpellDefinition, type World } from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

const BULWARK: SpellDefinition = { id: 1311015, name: "Templar's Bulwark", rank: 1, icon: 135880, isHelpful: true, cooldownSeconds: 120 };

/** A paladin with Templar's Bulwark on button 1, at this health (percent). */
function createPaladin(health: number, saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        learnSpell(state, BULWARK);
        state.bars[1] = BULWARK.id;
        state.health = health;
    }, saved);
    world.advance(1);
    return world;
}

describe("Templar's Bulwark, a paladin's defensive at low health", () => {
    it("shows at 10% health or below, and is lit but unseen above it: one glow, no proc glow beside it", () => {
        expect(createPaladin(8).glowAlphasOn(1)).toEqual([1]);
        expect(createPaladin(60).glowAlphasOn(1)).toEqual([0]);
    });

    it("follows the health as it changes", () => {
        const world = createPaladin(60);
        world.state.health = 5;
        world.advance(0.5);
        expect(world.glowAlphasOn(1)).toEqual([1]);
    });

    it("is not lit while it is on its cooldown, nor when the player switched it off", () => {
        const world = createPaladin(8);
        world.state.cooldowns[BULWARK.id] = { start: GetTime(), duration: 120 };
        world.advance(1);
        expect(world.glowAlphasOn(1)).toEqual([]);
        expect(createPaladin(8, { enabledSpells: { [tostring(BULWARK.id)]: false } }).glowAlphasOn(1)).toEqual([]);
    });

    it("is as strong as its row's glow %", () => {
        const world = createPaladin(8, { spellStyles: { "proc:Templar's Bulwark": { glowPercent: 50 } } });
        expect(world.glowAlphasOn(1)).toEqual([0.5]);
    });

    it("has a row among the procs in the table", () => {
        const world = createPaladin(60);
        toggleTable();
        const row = findLabel(world, BULWARK.name)?.parent;
        expect(row?.fontStrings.some((line) => line.text === "Proc")).toBe(true);
    });
});
