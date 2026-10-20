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
import { switchInTable } from "./table.helpers";

const BLESSING_OF_MIGHT_ID = 19740;
const RIGHTEOUSNESS: SpellDefinition = { id: 20154, name: "Seal of Righteousness", rank: 1, icon: 132325, isHelpful: true };
const CRUSADER: SpellDefinition = { id: 21082, name: "Seal of the Crusader", rank: 1, icon: 135924, isHelpful: true };
const JUDGEMENT: SpellDefinition = { id: 20271, name: "Judgement", rank: 1, icon: 135959, isHelpful: false };

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

describe("a paladin with two seals on the bars", () => {
    let world!: World;

    function cast(spell: SpellDefinition): void {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-guid", spell.id);
        world.advance(0.5);
    }

    // In a fight the game hides the auras: the addon goes by the casts
    function startFight(): void {
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
    }

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PALADIN);
            for (const spell of [RIGHTEOUSNESS, CRUSADER, JUDGEMENT]) learnSpell(state, spell);
            state.bars[1] = RIGHTEOUSNESS.id;
            state.bars[2] = CRUSADER.id;
            state.bars[3] = JUDGEMENT.id;
        });
        world.advance(1);
    });

    it("sees no seal glow out of combat", () => {
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("sees the first seal glow in a fight with no seal up", () => {
        startFight();
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("sees no seal glow once one is cast, until its 30 seconds are over", () => {
        startFight();
        cast(CRUSADER);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(0);
        world.advance(31);
        // The seal used last is the one to put on again
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("keeps the seal up after a Judgement: in Forever it does not use the seal up", () => {
        startFight();
        cast(RIGHTEOUSNESS);
        cast(JUDGEMENT);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("sees no seal glow once the seals are switched off in the table", () => {
        switchInTable(world, "Missing seal", false);
        startFight();
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("a paladin who cancels an aura in a fight", () => {
    const DEVOTION_AURA: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PALADIN);
            learnSpell(state, DEVOTION_AURA);
            learnSpell(state, BLESSING_OF_KINGS);
            state.bars[1] = DEVOTION_AURA.id;
            state.auras.push({ name: DEVOTION_AURA.name, spellId: DEVOTION_AURA.id, expirationTime: 99999 });
            state.auras.push({ name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 99999 });
        });
        world.advance(1);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
    });

    it("sees it glow when the game shows the auras and it is gone", () => {
        expect(world.glowsOn(1)).toBe(0);
        world.state.auras = world.state.auras.filter((aura) => aura.name !== DEVOTION_AURA.name);
        world.fire("UNIT_AURA", "player");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("still counts it while the game hides the auras", () => {
        world.state.areAurasHidden = true;
        world.fire("UNIT_AURA", "player");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });
});
