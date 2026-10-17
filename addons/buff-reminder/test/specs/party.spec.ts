import {
    beforeEach,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    POWER,
    type ClientState,
    createWorld,
    type World,
    FORTITUDE,
    HOLY_CANDLE,
    PRAYER_OF_FORTITUDE,
    PRIEST,
} from "@wowkit/test-kit";

/** A priest with Fortitude on button 1 and Prayer of Fortitude on button 2, in a party of three. */
function setUpPartyOfThree(state: ClientState, isResting: boolean): void {
    playAs(state, PRIEST);
    learnSpell(state, FORTITUDE);
    learnSpell(state, PRAYER_OF_FORTITUDE);
    state.reagentTexts[PRAYER_OF_FORTITUDE.id] = "Holy Candle";
    state.bars[1] = FORTITUDE.id;
    state.bars[2] = PRAYER_OF_FORTITUDE.id;
    state.bags[HOLY_CANDLE] = 0;
    state.isResting = isResting;
    state.party = [
        { name: "Bob", classToken: "WARRIOR", power: POWER.Rage, auras: [] },
        { name: "Alice", classToken: "MAGE", power: POWER.Mana, auras: [] },
        { name: "Dead", classToken: "ROGUE", power: POWER.Energy, auras: [], isDead: true },
    ];
}

describe("a priest in a party", () => {
    let world!: World;

    describe("out of town, with no candles", () => {
        beforeEach(() => {
            world = createWorld((state) => {
                setUpPartyOfThree(state, false);
                // Another priest's Prayer of Fortitude is on the player
                state.auras.push({ name: PRAYER_OF_FORTITUDE.name, spellId: PRAYER_OF_FORTITUDE.id, expirationTime: 1000 + 3600 });
            });
            world.advance(1);
        });

        it("is told to cast the single buff on the members who miss it", () => {
            expect(world.notice()).toContain("Power Word: Fortitude missing on: Bob, Alice");
        });

        it("is not told about members who are dead", () => {
            expect(world.notice()).not.toContain("Dead");
        });

        it("sees the buff glow on its button", () => {
            expect(world.glowsOn(1)).toBe(1);
        });

        it("is told to cast the group version once there are candles", () => {
            world.state.bags[HOLY_CANDLE] = 20;
            world.fire("GROUP_ROSTER_UPDATE");
            world.advance(2);
            expect(world.notice()).toContain("Prayer of Fortitude missing on: Bob, Alice");
        });

        it("sees the group version glow on its button", () => {
            world.state.bags[HOLY_CANDLE] = 20;
            world.fire("GROUP_ROSTER_UPDATE");
            world.advance(2);
            expect(world.glowsOn(2)).toBe(1);
        });

        // The party is read once a second; a change of the roster must not wait for that
        it("is told at once when a member gets the buff from someone else", () => {
            world.state.party[1]?.auras.push(world.makeAura(FORTITUDE.name, FORTITUDE.id, 1800));
            world.fire("GROUP_ROSTER_UPDATE");
            world.advance(0.1);
            expect(world.notice()).toContain("Power Word: Fortitude missing on: Bob");
            expect(world.notice()).not.toContain("Alice");
        });

        it("is told about the single buff again when only one member misses it", () => {
            world.state.bags[HOLY_CANDLE] = 20;
            world.state.party[1]?.auras.push(world.makeAura(FORTITUDE.name, FORTITUDE.id, 1800));
            world.fire("GROUP_ROSTER_UPDATE");
            world.advance(2);
            expect(world.notice()).toContain("Power Word: Fortitude missing on: Bob");
            expect(world.notice()).not.toContain("Alice");
        });

        it("does not look at the party in combat, when the game hides other people's auras", () => {
            world.state.isInCombat = true;
            world.fire("GROUP_ROSTER_UPDATE");
            world.advance(2);
            expect(world.glowsOn(1)).toBe(0);
            expect(world.glowsOn(2)).toBe(0);
        });
    });
});

describe("a priest alone", () => {
    it("counts another priest's Prayer of Fortitude as Fortitude", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
            state.auras.push({ name: PRAYER_OF_FORTITUDE.name, spellId: PRAYER_OF_FORTITUDE.id, expirationTime: 1000 + 3600 });
        });
        expect(world.glowsOn(1)).toBe(0);
    });
});
