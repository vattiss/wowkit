import { createWorld, describe, expect, it, playAs, PRIEST, SHAMAN, WARRIOR, type World } from "@wowkit/test-kit";

function createPlayer(token = PRIEST, saved: Record<string, unknown> = {}): World {
    const world = createWorld((state) => playAs(state, token), saved);
    world.advance(1);
    return world;
}

describe("the settings window", () => {
    it("reaches every setting the page used to have", () => {
        const world = createPlayer();
        for (const name of [
            "isDisabled",
            "showTooltipIds",
            "roundAnimation",
            "cooldownManagerAccess",
            "trackedBuffsIcons",
            "bar_1",
            "fade_stance",
            "fadedOpacity",
            "messageSize",
            "messageTop",
            "showPartyBuffs",
            "partyGroupFrom",
        ]) {
            expect(world.hasOption(name)).toBe(true);
        }
    });

    it("does not name two controls the same", () => {
        // Finding a control fails on a name given twice
        const world = createPlayer();
        world.setOption("bar_1", false);
        world.setOption("fade_1", true);
        expect(world.getSavedSettings()?.barsThatGlow).toEqual({ "1": false });
    });

    it("changes the setting a control is for", () => {
        const world = createPlayer();
        world.setOption("messageSize", 150);
        expect(world.getSavedSettings()?.messageSize).toBe(150);
    });

    it("leaves out what a class does not have", () => {
        expect(createPlayer(WARRIOR).hasOption("partyGroupFrom")).toBe(false);
    });

    it("opens a frame after it is asked for, not inside the slash command", () => {
        const world = createPlayer();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsOptions")!;
        expect(window.isShown).toBe(false);
        SlashCmdList["GLOWINGBARS"]!("options", undefined as never);
        expect(window.isShown).toBe(false);
        world.advance(1);
        expect(window.isShown).toBe(true);
    });

    it("also opens with /gb settings", () => {
        const world = createPlayer();
        SlashCmdList["GLOWINGBARS"]!("settings", undefined as never);
        world.advance(1);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsOptions")!.isShown).toBe(true);
    });

    it("draws nothing of the addon in the rows of the game's Settings panel", () => {
        const world = createPlayer();
        expect(world.frames.some((frame) => frame.template === "SettingsListElementTemplate")).toBe(false);
    });
});

describe("the Defaults button of a tab", () => {
    function clickDefaults(world: World, tabTitle: string): void {
        world.openOptions();
        const button = (text: string) => world.frames.find((frame) => frame.frameType === "Button" && frame.text === text)!;
        button(tabTitle).scripts.OnClick!(button(tabTitle));
        button("Defaults").scripts.OnClick!(button("Defaults"));
    }

    it("puts that tab back and leaves the others", () => {
        const world = createPlayer();
        world.setOption("messageSize", 150);
        world.setOption("isDisabled", true);
        clickDefaults(world, "Messages");
        expect(world.getSavedSettings()?.messageSize).toBe(100);
        expect(world.getSavedSettings()?.isDisabled).toBe(true);
    });
});

describe("the Reload button of the Cooldown Manager", () => {
    const LABEL = "Reload To Apply This Change";

    it("only comes after a change that needs it, and reloads", () => {
        const world = createPlayer(SHAMAN);
        world.openOptions();
        expect(world.isOptionShown(LABEL)).toBe(false);
        world.setOption("cooldownManagerAccess", "readOnly");
        world.openOptions();
        expect(world.isOptionShown(LABEL)).toBe(true);
        world.clickOption(LABEL);
        expect(world.state.reloads).toBe(1);
    });

    it("does not come for a window shown or hidden, which applies at once", () => {
        const world = createPlayer(SHAMAN);
        world.setOption("essentialIcons", "show");
        world.openOptions();
        expect(world.isOptionShown(LABEL)).toBe(false);
    });
});
