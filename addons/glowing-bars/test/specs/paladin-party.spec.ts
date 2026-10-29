import {
    beforeEach,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    POWER,
    createWorld,
    type World,
    BLESSING_OF_KINGS,
    GREATER_BLESSING_OF_KINGS,
    PALADIN,
    SYMBOL_OF_KINGS,
    type SpellDefinition,
} from "@wowkit/test-kit";

const BLESSING_OF_MIGHT_ID = 19740;

describe("a paladin in a party", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, BLESSING_OF_KINGS);
                learnSpell(state, GREATER_BLESSING_OF_KINGS);
                state.reagentTexts[GREATER_BLESSING_OF_KINGS.id] = "Symbol of Kings";
                state.bags[SYMBOL_OF_KINGS] = 10;
                state.auras.push({ name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1000 + 300 });
                state.party = [
                    { name: "Tank", classToken: "WARRIOR", power: POWER.Rage, auras: [] },
                    // Another paladin's blessing is not the player's, so Kings is still missing on this member
                    {
                        name: "Dps",
                        classToken: "WARRIOR",
                        power: POWER.Rage,
                        auras: [{ name: "Blessing of Might", spellId: BLESSING_OF_MIGHT_ID, expirationTime: 1300, sourceUnit: "party4" }],
                    },
                    {
                        name: "Healer",
                        classToken: "PRIEST",
                        power: POWER.Mana,
                        auras: [
                            { name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300, sourceUnit: "player" },
                        ],
                    },
                    { name: "Caster", classToken: "MAGE", power: POWER.Mana, auras: [] },
                ];
            },
            { styles: { buff: { isTextOn: true } } },
        );
    });

    it("is told to cast the Greater Blessing when two members of one class miss the blessing", () => {
        expect(world.notice()).toContain("Greater Blessing of Kings missing on: Tank, Dps");
    });

    it("is told to cast the single blessing when only one member of a class misses it", () => {
        expect(world.notice()).toContain("Blessing of Kings missing on: Caster");
    });

    it("counts the player's own blessing on a member", () => {
        expect(world.notice()).not.toContain("Healer");
    });
});

describe("a paladin in a party who knows two blessings", () => {
    const BLESSING_OF_MIGHT: SpellDefinition = {
        id: BLESSING_OF_MIGHT_ID,
        name: "Blessing of Might",
        rank: 1,
        icon: 135906,
        isHelpful: true,
    };
    let world!: World;

    beforeEach(() => {
        world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                for (const spell of [BLESSING_OF_MIGHT, BLESSING_OF_KINGS, GREATER_BLESSING_OF_KINGS]) learnSpell(state, spell);
                state.reagentTexts[GREATER_BLESSING_OF_KINGS.id] = "Symbol of Kings";
                state.bags[SYMBOL_OF_KINGS] = 10;
                state.party = [{ name: "Caster", classToken: "MAGE", power: POWER.Mana, auras: [] }];
            },
            { styles: { buff: { isTextOn: true } } },
        );
    });

    function cast(spellId: number): void {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", spellId);
        world.fire("GROUP_ROSTER_UPDATE");
        world.advance(1);
    }

    it("is asked for the first blessing of the list before casting one, with no talent points to go by", () => {
        expect(world.notice()).toContain("Blessing of Might missing on: Caster");
    });

    it("is asked for the blessing of the main talent tree before casting one: Protection wants Kings", () => {
        world.state.talentPoints = [0, 31, 5];
        world.fire("GROUP_ROSTER_UPDATE");
        world.advance(1);
        expect(world.notice()).toContain("Blessing of Kings missing on: Caster");
    });

    it("is asked for the blessing cast last", () => {
        cast(BLESSING_OF_KINGS.id);
        expect(world.notice()).toContain("Blessing of Kings missing on: Caster");
        expect(world.notice()).not.toContain("Might missing on");
    });

    it("is asked for nothing on a member who has the player's Greater Blessing of Light: one blessing of the player each", () => {
        world.state.party[0]!.auras.push({
            name: "Greater Blessing of Light",
            spellId: 25890,
            expirationTime: 99999,
            sourceUnit: "player",
        });
        world.fire("GROUP_ROSTER_UPDATE");
        world.advance(1);
        expect(world.notice()).not.toContain("missing on");
    });

    it("counts a Greater Blessing as its blessing", () => {
        cast(GREATER_BLESSING_OF_KINGS.id);
        expect(world.notice()).toContain("Blessing of Kings missing on: Caster");
    });
});
