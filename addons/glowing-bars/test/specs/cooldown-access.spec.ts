import {
    createWorld,
    describe,
    expect,
    INNER_FIRE,
    it,
    learnSpell,
    LIGHTNING_SHIELD,
    playAs,
    PRIEST,
    SHAMAN,
    WARRIOR,
} from "@wowkit/test-kit";

describe("the Cooldown Manager at login", () => {
    it("is turned on for every class, and kept out of sight", () => {
        const world = createWorld((state) => playAs(state, WARRIOR));
        world.advance(1);
        expect(world.state.cvars.cooldownViewerEnabled).toBe(true);
        expect(world.state.viewerAlpha).toBe(0);
    });

    it("is left as it is for a player who had it on: read only, and it shows", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            state.cvars.cooldownViewerEnabled = true;
            learnSpell(state, LIGHTNING_SHIELD);
            state.buffCatalog.push({ spellId: LIGHTNING_SHIELD.id, isHiddenByDefault: true });
        });
        world.advance(6);
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("readOnly");
        expect(world.state.viewerAlpha).toBe(1);
        expect(world.state.viewerSaves).toBe(0);
    });

    it("is left to EllesmereUI when its Cooldown Manager is loaded: nothing is turned on, hidden or moved", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            state.loadedAddons.EllesmereUICooldownManager = true;
            learnSpell(state, LIGHTNING_SHIELD);
            state.buffCatalog.push({ spellId: LIGHTNING_SHIELD.id, isHiddenByDefault: true });
        });
        world.advance(6);
        expect(world.state.cvars.cooldownViewerEnabled).toBe(undefined);
        expect(world.state.viewerAlpha).toBe(undefined);
        expect(world.state.viewerSaves).toBe(0);
    });

    it("moves the buffs with EllesmereUI too when the player chose that", () => {
        const world = createWorld(
            (state) => {
                playAs(state, SHAMAN);
                state.loadedAddons.EllesmereUICooldownManager = true;
                learnSpell(state, LIGHTNING_SHIELD);
                state.buffCatalog.push({ spellId: LIGHTNING_SHIELD.id, isHiddenByDefault: true });
            },
            { isCooldownManagerSetUp: true },
        );
        world.advance(6);
        expect(world.state.viewerAlpha).toBe(undefined);
        expect(world.state.viewerSaves).toBe(1);
    });

    it("stays visible when the player chose that", () => {
        const world = createWorld((state) => playAs(state, SHAMAN), {
            isCooldownManagerSetUp: true,
            trackedBuffsIcons: "show",
            essentialIcons: "show",
            utilityIcons: "show",
        });
        world.advance(1);
        expect(world.state.viewerAlpha).toBe(1);
    });

    it("is not touched or read when the player chose to leave it alone", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.bars[1] = INNER_FIRE.id;
                state.isInCombat = true;
                state.areAurasHidden = true;
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false });
                state.buffCatalog.push({ spellId: INNER_FIRE.id, isHiddenByDefault: true });
            },
            { isCooldownManagerSetUp: true, cooldownManagerAccess: "off" },
        );
        world.advance(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", INNER_FIRE.id);
        world.advance(6);
        expect(world.state.cvars.cooldownViewerEnabled).toBe(undefined);
        expect(world.state.viewerSaves).toBe(0);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("turns it off again when the addon had turned it on and the player leaves it alone", () => {
        const world = createWorld(
            (state) => {
                playAs(state, SHAMAN);
                state.cvars.cooldownViewerEnabled = true;
            },
            { isCooldownManagerSetUp: true, isCooldownManagerOurs: true, cooldownManagerAccess: "off" },
        );
        world.advance(1);
        expect(world.state.cvars.cooldownViewerEnabled).toBe(false);
    });
});
