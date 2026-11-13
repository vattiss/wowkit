import {
    BLESSING_OF_KINGS,
    createWorld,
    describe,
    expect,
    GREATER_BLESSING_OF_KINGS,
    it,
    learnSpell,
    PALADIN,
    playAs,
    POWER,
    type FakeAura,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const BLESSING_OF_MIGHT: SpellDefinition = { id: 19740, name: "Blessing of Might", rank: 1, icon: 135906, isHelpful: true };

/** A paladin who knows Might and Kings, with Might on button 1, and these blessings on them. */
function createPaladin(onPlayer: FakeAura[]): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        learnSpell(state, BLESSING_OF_MIGHT);
        learnSpell(state, BLESSING_OF_KINGS);
        // Known to the game by name, as every spell is, though not learned
        state.spells[25782] ??= { id: 25782, name: "Greater Blessing of Might", rank: 1, icon: 135908, isHelpful: true };
        state.bars[1] = BLESSING_OF_MIGHT.id;
        state.auras.push(...onPlayer);
    });
    world.advance(1);
    return world;
}

describe("a paladin with another paladin's blessing on them (issue #68)", () => {
    it("is still asked for their own: blessings of different paladins stack", () => {
        const world = createPaladin([
            { name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300, sourceUnit: "party1" },
        ]);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is not asked for Might with their own Kings on: a paladin keeps one blessing of theirs on a target", () => {
        const world = createPaladin([
            { name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300, sourceUnit: "player" },
        ]);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("is not asked for Might with another paladin's Might on: the same blessing does not stack", () => {
        const world = createPaladin([
            { name: BLESSING_OF_MIGHT.name, spellId: BLESSING_OF_MIGHT.id, expirationTime: 1300, sourceUnit: "party1" },
        ]);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes by a Greater Blessing as by its blessing: another's Greater Kings, its caster unnamed, does not stop Might", () => {
        const kings = { name: GREATER_BLESSING_OF_KINGS.name, spellId: GREATER_BLESSING_OF_KINGS.id, expirationTime: 1300 };
        expect(createPaladin([kings]).glowsOn(1)).toBe(1);
        const might = { name: "Greater Blessing of Might", spellId: 25782, expirationTime: 1300, sourceUnit: "party1" };
        expect(createPaladin([might]).glowsOn(1)).toBe(0);
    });

    it("sees the glow go out once they bless themselves in a fight, while the game hides the auras", () => {
        const world = createPaladin([]);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", BLESSING_OF_MIGHT.id);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("keeps the answer in a fight, while the game hides the auras", () => {
        const world = createPaladin([
            { name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300, sourceUnit: "party1" },
        ]);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a paladin giving Kings to a party where another paladin gave Kings already", () => {
    it("is not asked for Kings on a member who has the other paladin's Kings or Greater Kings: they do not stack", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, BLESSING_OF_KINGS);
                state.auras.push({ name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300 });
                state.party = [
                    {
                        name: "Tank",
                        classToken: "WARRIOR",
                        power: POWER.Rage,
                        auras: [
                            { name: BLESSING_OF_KINGS.name, spellId: BLESSING_OF_KINGS.id, expirationTime: 1300, sourceUnit: "party4" },
                        ],
                    },
                    {
                        name: "Healer",
                        classToken: "PRIEST",
                        power: POWER.Mana,
                        auras: [
                            {
                                name: GREATER_BLESSING_OF_KINGS.name,
                                spellId: GREATER_BLESSING_OF_KINGS.id,
                                expirationTime: 1300,
                                sourceUnit: "party4",
                            },
                        ],
                    },
                    { name: "Caster", classToken: "MAGE", power: POWER.Mana, auras: [] },
                ];
            },
            { styles: { missingBuff: { isMessageOn: true } } },
        );
        world.advance(1);
        expect(world.notice()).toContain("Blessing of Kings missing on: Caster");
        expect(world.notice()).not.toContain("Tank");
        expect(world.notice()).not.toContain("Healer");
    });
});

describe("a paladin with another paladin's aura on them", () => {
    const RETRIBUTION: SpellDefinition = { id: 7294, name: "Retribution Aura", rank: 1, icon: 135873, isHelpful: true };
    const DEVOTION = { name: "Devotion Aura", spellId: 465, expirationTime: 0 };

    /** A paladin who knows Retribution Aura, on button 1, with this aura on them. */
    function createAuraPaladin(onPlayer: FakeAura): World {
        const world = createWorld((state) => {
            playAs(state, PALADIN);
            learnSpell(state, RETRIBUTION);
            state.bars[1] = RETRIBUTION.id;
            state.auras.push(onPlayer);
        });
        world.advance(1);
        return world;
    }

    it("is still asked for their own aura: auras of different paladins stack", () => {
        expect(createAuraPaladin({ ...DEVOTION, sourceUnit: "party1" }).glowsOn(1)).toBe(1);
    });

    it("is not asked with their own other aura on, nor with another paladin's same aura", () => {
        expect(createAuraPaladin({ ...DEVOTION, sourceUnit: "player" }).glowsOn(1)).toBe(0);
        const same = { name: RETRIBUTION.name, spellId: RETRIBUTION.id, expirationTime: 0, sourceUnit: "party1" };
        expect(createAuraPaladin(same).glowsOn(1)).toBe(0);
    });
});
