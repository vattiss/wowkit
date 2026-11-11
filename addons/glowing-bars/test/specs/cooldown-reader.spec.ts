import {
    createWorld,
    describe,
    expect,
    INNER_FIRE,
    it,
    learnSpell,
    MAGE,
    playAs,
    PRIEST,
    type SpellDefinition,
    type World,
    DRUID,
    THORNS,
} from "@wowkit/test-kit";

describe("one reader for the icons", () => {
    /** A priest in a fight with Inner Fire just cast, and the icon the test gives; a moment later the icon has changed. */
    function createFight(
        icon: { spellId?: number; isActive: boolean; unit?: string; isInSpellsTab?: boolean; isOwnBuff?: boolean },
        linked?: number[],
    ): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.bars[1] = INNER_FIRE.id;
            state.isInCombat = true;
            state.areAurasHidden = true;
            const spellId = icon.spellId ?? INNER_FIRE.id;
            state.spells[spellId] ??= { id: spellId, name: "Linked entry", rank: 1, icon: 1 };
            state.trackedBuffs.push({ ...icon, spellId, isActive: true });
            state.linkedSpells[spellId] = linked;
        });
        world.advance(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", INNER_FIRE.id);
        world.advance(1);
        world.state.trackedBuffs[0]!.isActive = icon.isActive;
        world.advance(1);
        return world;
    }

    it("reads a buff on the Spells tab by its aura", () => {
        expect(createFight({ isActive: false, isInSpellsTab: true, isOwnBuff: true }).glowsOn(1)).toBe(1);
        expect(createFight({ isActive: true, isInSpellsTab: true, isOwnBuff: true }).glowsOn(1)).toBe(0);
    });

    it("gives a spell of the Spells tab with no buff of its own no say", () => {
        expect(createFight({ isActive: false, isInSpellsTab: true, isOwnBuff: false }).glowsOn(1)).toBe(0);
    });

    it("finds a buff by a spell linked to the entry", () => {
        expect(createFight({ spellId: 999001, isActive: false }, [INNER_FIRE.id]).glowsOn(1)).toBe(1);
    });

    it("does not take the player's buff on the target for a buff on the player", () => {
        expect(createFight({ isActive: true, unit: "target" }).glowsOn(1)).toBe(1);
    });

    it("gives the shared icon of the shapeshift forms no say", () => {
        const MOONKIN: SpellDefinition = { id: 24858, name: "Moonkin Form", rank: 1, icon: 136036 };
        const FORMS = 999002;
        const world = createWorld(
            (state) => {
                playAs(state, DRUID);
                learnSpell(state, MOONKIN);
                learnSpell(state, THORNS);
                state.bars[1] = MOONKIN.id;
                state.isInCombat = true;
                state.areAurasHidden = true;
                state.spells[FORMS] = { id: FORMS, name: "Druid Forms", rank: 1, icon: 1 };
                state.linkedSpells[FORMS] = [MOONKIN.id];
                state.trackedBuffs.push({ spellId: FORMS, isActive: true });
            },
            { enabledBuffs: { Moonkin: true } },
        );
        world.advance(1);
        // Something else is remembered: the empty list is the game hiding the auras
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", THORNS.id);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("does not believe the icon being out for a buff another player cast", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.bars[1] = INNER_FIRE.id;
            state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false });
        });
        world.state.auras.push(world.makeAura(INNER_FIRE.name, INNER_FIRE.id, 600, "party1"));
        world.advance(2);
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("tells a cooldown the game hides from the icon on the Spells tab", () => {
        const STRIKE: SpellDefinition = { id: 999003, name: "Test Strike", rank: 1, icon: 1, cooldownSeconds: 10 };
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, STRIKE);
                state.bars[1] = STRIKE.id;
                state.isInCombat = true;
                state.areCooldownsHidden = true;
                state.trackedBuffs.push({ spellId: STRIKE.id, isActive: false, isInSpellsTab: true, isOnCooldown: true });
            },
            { addedSpells: [{ id: STRIKE.id, reminderType: "readyCooldown" }] },
        );
        world.advance(2);
        expect(world.glowsOn(1)).toBe(0);
        world.state.trackedBuffs[0]!.isOnCooldown = false;
        world.advance(2);
        expect(world.glowsOn(1)).toBe(1);
    });

    describe("for a proc", () => {
        const MISSILES: SpellDefinition = { id: 5143, name: "Arcane Missiles", rank: 1, icon: 136096, maxRange: 30, isHarmful: true };
        const BARRAGE = 400588;
        const CLEARCASTING = 12536;

        function createMage(cost: number, barrage: boolean | undefined, clearcasting: boolean | undefined): World {
            const world = createWorld((state) => {
                playAs(state, MAGE);
                learnSpell(state, MISSILES);
                state.bars[1] = MISSILES.id;
                state.spellCosts[MISSILES.id] = cost;
                state.spells[BARRAGE] = { id: BARRAGE, name: "Missile Barrage", rank: 1, icon: 1 };
                state.spells[CLEARCASTING] = { id: CLEARCASTING, name: "Clearcasting", rank: 1, icon: 1 };
                if (barrage !== undefined) state.trackedBuffs.push({ spellId: BARRAGE, isActive: barrage });
                if (clearcasting !== undefined) state.trackedBuffs.push({ spellId: CLEARCASTING, isActive: clearcasting });
            });
            world.advance(2);
            return world;
        }

        it("glows when an icon is up, whatever the spell costs", () => {
            expect(createMage(85, true, false).glowsOn(1)).toBe(1);
        });

        it("does not glow when all its icons are out", () => {
            expect(createMage(0, false, false).glowsOn(1)).toBe(0);
        });

        it("falls back on its spell when an icon has no say", () => {
            expect(createMage(0, false, undefined).glowsOn(1)).toBe(1);
        });
    });
});
