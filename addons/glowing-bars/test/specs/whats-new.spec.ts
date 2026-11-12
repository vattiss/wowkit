import { createWorld, describe, expect, it, playAs, PRIEST, type World } from "@wowkit/test-kit";

/** A priest on an account that last logged in with `lastVersion` (undefined: the account's first run). */
function createAccountWorld(account?: Record<string, unknown>, isInCombat = false): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.accountSaved = account;
        state.isInCombat = isInCombat;
    });
    world.advance(5);
    return world;
}

/** Is the settings window open on the What's New tab? */
function isTabShown(world: World): boolean {
    const window = world.findFrame((frame) => frame.name === "GlowingBarsOptions");
    // The switch of the tab is in its footer, shown with the tab
    const footer = world.frames.find(
        (frame) => (frame as unknown as { optionVariable?: string }).optionVariable === "GlowingBars_showWhatsNew",
    );
    return window?.isShown === true && footer?.isShown === true;
}

describe("the What's New tab", () => {
    it("stays closed on the account's first run, and notes the version it started with", () => {
        const world = createAccountWorld();
        expect(isTabShown(world)).toBe(false);
        expect(world.getAccountSaved()?.lastVersion).toBeDefined();
    });

    it("opens once after an update with something new in it, for a player who asked for it", () => {
        expect(isTabShown(createAccountWorld({ lastVersion: "1.0.0", isWhatsNewOn: true }))).toBe(true);
    });

    it("stays closed when nothing changed since the last login", () => {
        const current = createAccountWorld().getAccountSaved()?.lastVersion;
        expect(isTabShown(createAccountWorld({ lastVersion: current }))).toBe(false);
    });

    it("stays closed unless the player asked for it, also for one who had the old switch on", () => {
        expect(isTabShown(createAccountWorld({ lastVersion: "1.0.0" }))).toBe(false);
        const world = createAccountWorld({ lastVersion: "1.0.0", isWhatsNewOff: false });
        expect(isTabShown(world)).toBe(false);
        expect(world.getAccountSaved()?.isWhatsNewOff).toBe(undefined);
    });

    it("waits for the fight to end", () => {
        const world = createAccountWorld({ lastVersion: "1.0.0", isWhatsNewOn: true }, true);
        expect(isTabShown(world)).toBe(false);
        world.state.isInCombat = false;
        world.fire("PLAYER_REGEN_ENABLED");
        expect(isTabShown(world)).toBe(true);
    });

    it("is switched on for the whole account, on its tab or on the General tab", () => {
        const world = createAccountWorld({ lastVersion: "1.0.0" });
        world.setOption("showWhatsNew", true);
        expect(world.getAccountSaved()?.isWhatsNewOn).toBe(true);
        world.setOption("accountShowWhatsNew", false);
        expect(world.getAccountSaved()?.isWhatsNewOn).toBe(undefined);
    });

    it("keeps the choices for the whole account when a character's General tab is put back to its defaults", () => {
        const world = createAccountWorld({ lastVersion: "1.0.0", isWhatsNewOn: true, isWelcomeOn: true });
        world.openOptions();
        const button = (text: string) => world.frames.find((frame) => frame.frameType === "Button" && frame.text === text)!;
        button("General").scripts.OnClick!(button("General"));
        button("Defaults").scripts.OnClick!(button("Defaults"));
        const box = world.frames.find((frame) => frame.name === "GlowingBarsOptionsQuestion")!;
        const reset = world.frames.find((frame) => frame.parent === box && frame.text === "Reset")!;
        reset.scripts.OnClick!(reset);
        expect(world.getAccountSaved()?.isWhatsNewOn).toBe(true);
        expect(world.getAccountSaved()?.isWelcomeOn).toBe(true);
    });

    it("shows the notes of the newest version, and of another one picked on the left", () => {
        const world = createAccountWorld({ lastVersion: "1.0.0", isWhatsNewOn: true });
        const hasText = (part: string) => world.frames.some((frame) => frame.fontStrings.some((text) => (text.text ?? "").includes(part)));
        // The newest version is the first on the left
        const newest = world.frames.find(
            (frame) => frame.frameType === "Button" && string.match(frame.text ?? "", "^%d+%.%d+%.%d+$")[0] !== undefined,
        )!;
        expect(hasText(`Glowing Bars ${newest.text}`)).toBe(true);
        expect(newest.text).not.toBe("2.8.0");
        const version = world.frames.find((frame) => frame.frameType === "Button" && frame.text === "2.8.0")!;
        version.scripts.OnClick!(version);
        expect(hasText("Glowing Bars 2.8.0")).toBe(true);
    });

    it("opens by itself after a major release with something new, from a patch before it", () => {
        expect(isTabShown(createAccountWorld({ lastVersion: "2.9.1", isWhatsNewOn: true }))).toBe(true);
    });

    it("does not open by itself when nothing came out since the last login", () => {
        expect(isTabShown(createAccountWorld({ lastVersion: "3.0.0" }))).toBe(false);
    });
});

describe("the slash commands", () => {
    it("open the table with /gb and /gb table, and the settings with /gb settings", () => {
        const world = createAccountWorld();
        const table = () => world.findFrame((frame) => frame.name === "GlowingBarsLooks")?.isShown === true;
        const settings = () => world.findFrame((frame) => frame.name === "GlowingBarsOptions")?.isShown === true;
        SlashCmdList["GLOWINGBARS"]!("table", undefined as never);
        expect(table()).toBe(true);
        SlashCmdList["GLOWINGBARS"]!("settings", undefined as never);
        world.advance(1);
        expect(settings()).toBe(true);
    });
});
