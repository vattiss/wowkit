// The cooldowns that are not simply a spell's own: the ranks of a spell share one, a trinket's use spell has its item's, and
// one only the tooltip names (Faerie Fire in Bear Form on Forever).
import {
    createWorld,
    describe,
    DRUID,
    expect,
    it,
    learnSpell,
    playAs,
    PRIEST,
    WARRIOR,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { findAddRowOf, toggleTable } from "./table.helpers";

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

describe("a cooldown only the tooltip names, as Faerie Fire's in Bear Form", () => {
    const FAERIE_FIRE: SpellDefinition = { id: 770, name: "Faerie Fire", rank: 1, icon: 1, isHarmful: true };

    function setUpBear(state: ClientState): void {
        playAs(state, DRUID);
        learnSpell(state, FAERIE_FIRE);
        state.bars[1] = FAERIE_FIRE.id;
        state.tooltipCooldowns[FAERIE_FIRE.id] = "6 sec cooldown";
    }

    it("can be added as a Ready cooldown", () => {
        const world = createWorld(setUpBear);
        world.advance(1);
        toggleTable();
        const { box, add } = findAddRowOf(world);
        box.text = "770";
        add.scripts.OnClick!(add);
        expect(world.getSavedSettings()?.addedSpells).toEqual([{ id: 770, reminderType: "readyCooldown" }]);
    });

    it("can be added out of Bear Form too, as one of the spells known to have a cooldown in a form", () => {
        const world = createWorld((state) => {
            setUpBear(state);
            state.tooltipCooldowns[FAERIE_FIRE.id] = undefined;
        });
        world.advance(1);
        toggleTable();
        const { box, add } = findAddRowOf(world);
        box.text = "770";
        add.scripts.OnClick!(add);
        expect(world.getSavedSettings()?.addedSpells).toEqual([{ id: 770, reminderType: "readyCooldown" }]);
    });

    it("is read in a language that puts the unit in the plural", () => {
        const world = createWorld((state) => {
            setUpBear(state);
            state.tooltipCooldowns[FAERIE_FIRE.id] = "2 Minuten Abklingzeit";
        });
        (_G as unknown as { SPELL_RECAST_TIME_MIN: string }).SPELL_RECAST_TIME_MIN = "%.3g |4Minute:Minuten; Abklingzeit";
        world.advance(1);
        toggleTable();
        const { box, add } = findAddRowOf(world);
        box.text = "770";
        add.scripts.OnClick!(add);
        expect(world.getSavedSettings()?.addedSpells).toEqual([{ id: 770, reminderType: "readyCooldown" }]);
    });

    it("puts the glow out for that long once it is cast", () => {
        const world = createWorld(setUpBear, {
            styles: { readyCooldown: { glowTime: 0 } },
            addedSpells: [{ id: FAERIE_FIRE.id, reminderType: "readyCooldown" }],
        });
        world.setOption("showCooldownsAtFightStart", true);
        world.state.isInCombat = true;
        world.state.areCooldownsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", FAERIE_FIRE.id);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        world.advance(6);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("glows only in the form where it has a cooldown", () => {
        const world = createWorld(setUpBear, {
            styles: { readyCooldown: { when: "always" } },
            addedSpells: [{ id: FAERIE_FIRE.id, reminderType: "readyCooldown" }],
        });
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        world.state.tooltipCooldowns[FAERIE_FIRE.id] = undefined;
        world.fire("UPDATE_SHAPESHIFT_FORM");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        world.state.tooltipCooldowns[FAERIE_FIRE.id] = "6 sec cooldown";
        world.fire("UPDATE_SHAPESHIFT_FORM");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });
});
