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
    type World,
} from "@wowkit/test-kit";

/** The warning line of the Cooldown Manager tab, while the manager waits for a reload. */
function isWarningShown(world: World, words: string): boolean {
    return world.frames.some((frame) => frame.isShown && frame.fontStrings.some((line) => line.text?.includes(words) === true));
}

describe("the Cooldown Manager at login", () => {
    it("is turned on for every class at the next logout or reload, not while the game runs (that taints Blizzard's code)", () => {
        const world = createWorld((state) => playAs(state, WARRIOR));
        world.advance(1);
        expect(world.state.cvars.cooldownViewerEnabled).toBe(undefined);
        expect(world.state.viewerAlpha).toBe(0);
        world.fire("PLAYER_LOGOUT");
        expect(world.state.cvars.cooldownViewerEnabled).toBe(true);
        expect(world.getSavedSettings()?.isCooldownManagerOurs).toBe(true);
    });

    it("is turned on by the Reload button just before it reloads, and the tab warns until then", () => {
        const world = createWorld((state) => playAs(state, WARRIOR));
        world.advance(1);
        world.openOptions();
        expect(isWarningShown(world, "turns on at your next reload")).toBe(true);
        world.clickOption("Your choice works after a reload");
        expect(world.state.cvars.cooldownViewerEnabled).toBe(true);
        expect(world.state.reloads).toBe(1);
    });

    it("gives no warning when the manager is on already", () => {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            state.cvars.cooldownViewerEnabled = true;
        });
        world.advance(1);
        world.openOptions();
        expect(isWarningShown(world, "turns on at your next reload")).toBe(false);
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

    it("adds what it needs for a new character that the game has it on for, and keeps its windows", () => {
        const world = createWorld(
            (state) => {
                playAs(state, SHAMAN);
                state.cvars.cooldownViewerEnabled = true;
                learnSpell(state, LIGHTNING_SHIELD);
                state.buffCatalog.push({ spellId: LIGHTNING_SHIELD.id, isHiddenByDefault: true });
            },
            { isWelcomeDone: false },
        );
        world.advance(6);
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("full");
        expect(world.state.viewerAlpha).toBe(1);
        expect(world.state.viewerSaves).toBe(1);
    });

    it("adds what it needs for a new character with EllesmereUI too, and leaves the windows to it", () => {
        const world = createWorld(
            (state) => {
                playAs(state, SHAMAN);
                state.loadedAddons.EllesmereUICooldownManager = true;
                learnSpell(state, LIGHTNING_SHIELD);
                state.buffCatalog.push({ spellId: LIGHTNING_SHIELD.id, isHiddenByDefault: true });
            },
            { isWelcomeDone: false },
        );
        world.advance(6);
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("full");
        expect(world.state.viewerAlpha).toBe(undefined);
        expect(world.state.viewerSaves).toBe(1);
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
        expect(world.state.cvars.cooldownViewerEnabled).toBe(true);
        world.openOptions();
        expect(isWarningShown(world, "turns off at your next reload")).toBe(true);
        world.fire("PLAYER_LOGOUT");
        expect(world.state.cvars.cooldownViewerEnabled).toBe(false);
        expect(world.getSavedSettings()?.isCooldownManagerOurs).toBe(false);
    });
});
