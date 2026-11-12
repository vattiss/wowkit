import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    FORTITUDE,
    PRIEST,
    SHAMAN,
    type FakeFrame,
    type World,
} from "@wowkit/test-kit";

const SCAN_LABEL = "Check that Glowing Bars finds your buttons";

function createPlayer(saved: Record<string, unknown>, account?: Record<string, unknown>, token = PRIEST): World {
    return createWorld((state) => {
        playAs(state, token);
        learnSpell(state, FORTITUDE);
        state.bars[1] = FORTITUDE.id;
        state.accountSaved = account;
    }, saved);
}

function findWindow(world: World): FakeFrame | undefined {
    return world.findFrame((frame) => frame.name === "GlowingBarsOptions");
}

/** Is the tab with the row of this label the one shown? */
function isTabShown(world: World, rowLabel: string): boolean {
    const row = world.frames.find((frame) => (frame as unknown as { optionLabel?: string }).optionLabel === rowLabel);
    return findWindow(world)?.isShown === true && row?.parent?.isShown === true;
}

function findReport(world: World): FakeFrame | undefined {
    return world.frames.find((frame) => frame.frameType === "EditBox" && frame.template === "InputBoxTemplate");
}

describe("the Welcome tab", () => {
    it("opens by itself once for a character that never saw it", () => {
        const world = createPlayer({ isWelcomeDone: false, isCooldownChoiceSeen: false });
        world.advance(4);
        expect(isTabShown(world, SCAN_LABEL)).toBe(true);
        expect(world.getSavedSettings()?.isWelcomeDone).toBe(true);
        expect(world.getSavedSettings()?.isCooldownChoiceSeen).toBe(true);
    });

    it("opens once for a character that saw the old welcome but not the Cooldown Manager choice", () => {
        const world = createPlayer({ isWelcomeDone: true, isCooldownChoiceSeen: false });
        world.advance(4);
        expect(isTabShown(world, SCAN_LABEL)).toBe(true);
    });

    it("stays closed for a new character when the player switched it off for the account", () => {
        const world = createPlayer({ isWelcomeDone: false, isCooldownChoiceSeen: false }, { isWelcomeOff: true });
        world.advance(4);
        expect(findWindow(world)?.isShown ?? false).toBe(false);
    });

    it("is switched off for the account at the bottom of its tab, and on again on the General tab", () => {
        const world = createPlayer({});
        world.setOption("showWelcome", false);
        expect(world.getAccountSaved()?.isWelcomeOff).toBe(true);
        world.setOption("accountShowWelcome", true);
        expect(world.getAccountSaved()?.isWelcomeOff).toBe(undefined);
    });

    it("stays closed for a character that saw both", () => {
        const world = createPlayer({});
        world.advance(4);
        expect(findWindow(world)?.isShown ?? false).toBe(false);
    });

    it("waits for the fight to end", () => {
        const world = createPlayer({ isWelcomeDone: false, isCooldownChoiceSeen: false });
        world.state.isInCombat = true;
        world.advance(4);
        expect(findWindow(world)?.isShown ?? false).toBe(false);
        world.state.isInCombat = false;
        world.fire("PLAYER_REGEN_ENABLED");
        expect(isTabShown(world, SCAN_LABEL)).toBe(true);
    });

    it("scans only when asked, and keeps what it found", () => {
        const world = createPlayer({ isWelcomeDone: false, isCooldownChoiceSeen: false });
        world.advance(400);
        expect(findReport(world)?.text ?? "").toBe("");
        world.clickOption(SCAN_LABEL);
        world.advance(400);
        const report = findReport(world)?.text ?? "";
        for (const part of ["buttons", "PRIEST", "no bar addon", "spellbook", "macros read"]) expect(report).toContain(part);
        world.openOptions();
        expect(findReport(world)?.text).toContain("buttons");
        const select = world.frames.find((frame) => frame.frameType === "Button" && frame.text === "Select")!;
        select.scripts.OnClick!(select);
        expect(world.frames.some((frame) => frame.fontStrings.some((text) => text.text === "Now press Ctrl+C"))).toBe(true);
    });

    it("picks a choice by a click on its words too, not only on the round button", () => {
        const world = createPlayer({ cooldownManagerAccess: "readOnly" }, undefined, SHAMAN);
        world.openOptions();
        const row = world.frames.find(
            (frame) => (frame as unknown as { optionVariable?: string }).optionVariable === "GlowingBars_welcome_access_off",
        )!;
        row.scripts.OnMouseDown!(row);
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("off");
    });

    it("changes the setting at once, and offers the reload", () => {
        const world = createPlayer({ cooldownManagerAccess: "readOnly" }, undefined, SHAMAN);
        world.openOptions();
        world.setOption("welcome_access_full", true);
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("full");
        world.clickOption("Your choice works after a reload");
        expect(world.state.reloads).toBe(1);
    });

    it("offers the choice with EllesmereUI too", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            state.loadedAddons.EllesmereUICooldownManager = true;
        });
        world.advance(1);
        expect(world.hasOption("welcome_access_full")).toBe(true);
    });
});

describe("What's New with the Welcome tab", () => {
    it("does not take the window over: the Welcome tab comes first", () => {
        const world = createPlayer({ isWelcomeDone: false, isCooldownChoiceSeen: false }, { lastVersion: "1.0.0" });
        world.advance(4);
        expect(isTabShown(world, SCAN_LABEL)).toBe(true);
    });
});
