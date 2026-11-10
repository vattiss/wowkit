import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type SpellDefinition, type World } from "@wowkit/test-kit";

const TOUCH_OF_WEAKNESS: SpellDefinition = { id: 2652, name: "Touch of Weakness", rank: 1, icon: 1, isHelpful: true };
const SHADOWGUARD: SpellDefinition = { id: 18137, name: "Shadowguard", rank: 1, icon: 1, isHelpful: true };

function createPriest(spell: SpellDefinition, race: string, saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.race = { id: 5, file: race };
        learnSpell(state, spell);
        state.bars[1] = spell.id;
    }, saved);
    world.advance(2);
    return world;
}

describe("the racial buffs of a priest", () => {
    for (const [spell, key, race, otherRace] of [
        [TOUCH_OF_WEAKNESS, "TouchOfWeakness", "Scourge", "Troll"],
        [SHADOWGUARD, "Shadowguard", "Troll", "Scourge"],
    ] as const) {
        it(`leaves ${spell.name} alone until it is switched on`, () => {
            expect(createPriest(spell, race, {}).glowsOn(1)).toBe(0);
        });

        it(`does not list ${spell.name} for another race, even with the spell learned`, () => {
            expect(createPriest(spell, otherRace, { enabledBuffs: { [key]: true } }).glowsOn(1)).toBe(0);
        });

        it(`reminds of ${spell.name} once it is switched on, until it is up`, () => {
            const world = createPriest(spell, race, { enabledBuffs: { [key]: true } });
            expect(world.glowsOn(1)).toBe(1);
            world.state.auras.push(world.makeAura(spell.name, spell.id, 600));
            world.fire("UNIT_AURA", "player");
            world.advance(2);
            expect(world.glowsOn(1)).toBe(0);
        });
    }

    it("trusts a cast for its 10 minutes while the game hides the buffs, also when it was added by hand", () => {
        const world = createPriest(TOUCH_OF_WEAKNESS, "Scourge", {
            addedSpells: [{ id: TOUCH_OF_WEAKNESS.id, reminderType: "missingBuff" }],
        });
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", TOUCH_OF_WEAKNESS.id);
        world.advance(40);
        expect(world.glowsOn(1)).toBe(0);
    });
});
