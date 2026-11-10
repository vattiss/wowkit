// The cooldowns that are not simply a spell's own: the ranks of a spell share one, and a trinket's use spell has its item's.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";

describe("a priest with a higher rank of Fade on the bars", () => {
    const FADE: SpellDefinition = { id: 586, name: "Fade", rank: 1, icon: 135994, cooldownSeconds: 30, isHelpful: true };
    const FADE_TOP: SpellDefinition = { ...FADE, id: 10942, rank: 6 };

    function createPriest(): World {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, FADE);
                learnSpell(state, FADE_TOP);
                state.bars[1] = FADE_TOP.id;
            },
            { styles: { readyCooldown: { glowTime: 0 } } },
        );
        world.setOption("showCooldownsAtFightStart", true);
        world.state.isInCombat = true;
        world.state.areCooldownsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
        return world;
    }

    it("loses the glow at the cast of that rank, in a fight where the game hides the cooldowns", () => {
        const world = createPriest();
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", FADE_TOP.id);
        world.advance(1.5);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("keeps the glow when an item's spell of the same name is used", () => {
        const world = createPriest();
        world.state.spells[99586] = { ...FADE, id: 99586 };
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", 99586);
        world.advance(1.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a trinket added as a cooldown by its use spell", () => {
    const EPHEMERAL_POWER: SpellDefinition = { id: 23271, name: "Ephemeral Power", rank: 1, icon: 1, isHelpful: true };
    const TALISMAN = 18820;

    it("loses the glow when the trinket is used, and has it back once the item's cooldown is over", () => {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                state.spells[EPHEMERAL_POWER.id] = EPHEMERAL_POWER;
                state.itemUseSpells[TALISMAN] = EPHEMERAL_POWER.id;
                state.equippedItems[13] = TALISMAN;
                state.barItems[5] = TALISMAN;
                // The game counts an equipped item too
                state.bags[TALISMAN] = 1;
            },
            { styles: { readyCooldown: { glowTime: 0 } }, addedSpells: [{ id: EPHEMERAL_POWER.id, reminderType: "readyCooldown" }] },
        );
        world.setOption("showCooldownsAtFightStart", true);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(0.5);
        expect(world.glowsOn(5)).toBe(1);
        world.state.itemCooldowns[TALISMAN] = { start: GetTime(), duration: 90 };
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", EPHEMERAL_POWER.id);
        world.advance(1);
        expect(world.glowsOn(5)).toBe(0);
        world.advance(90);
        expect(world.glowsOn(5)).toBe(1);
    });
});
