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
