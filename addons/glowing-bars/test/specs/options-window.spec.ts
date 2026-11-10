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
        SlashCmdList["GLOWINGBARS"]!("settings", undefined as never);
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

describe("moving between the windows", () => {
    const find = (world: World, name: string) => world.frames.find((frame) => frame.name === name);
    const click = (world: World, text: string) => {
        const button = world.frames.find((frame) => frame.frameType === "Button" && frame.text === text && frame.parent?.isShown === true)!;
        button.scripts.OnClick!(button);
    };

    it("closes the settings when the table opens from them, and the other way round", () => {
        const world = createPlayer();
        world.openOptions();
        click(world, "Open Table");
        expect(find(world, "GlowingBarsOptions")!.isShown).toBe(false);
        expect(find(world, "GlowingBarsLooks")!.isShown).toBe(true);
        click(world, "Settings");
        world.advance(1);
        expect(find(world, "GlowingBarsLooks")!.isShown).toBe(false);
        expect(find(world, "GlowingBarsOptions")!.isShown).toBe(true);
    });

    it("closes with the gamepad's B or Back button", () => {
        const world = createPlayer();
        world.openOptions();
        const window = find(world, "GlowingBarsOptions")!;
        window.scripts.OnGamePadButtonDown!(window, "PAD1");
        expect(window.isShown).toBe(true);
        window.scripts.OnGamePadButtonDown!(window, "PAD2");
        expect(window.isShown).toBe(false);
        world.openOptions();
        window.scripts.OnGamePadButtonDown!(window, "PADBACK");
        expect(window.isShown).toBe(false);
    });
});

describe("the Defaults button", () => {
    it("is only there for a tab with something to put back", () => {
        const world = createPlayer();
        world.openOptions();
        const button = (text: string) => world.frames.find((frame) => frame.frameType === "Button" && frame.text === text)!;
        button("Help").scripts.OnClick!(button("Help"));
        expect(button("Defaults").isShown).toBe(false);
        button("Welcome").scripts.OnClick!(button("Welcome"));
        expect(button("Defaults").isShown).toBe(false);
        button("Bars").scripts.OnClick!(button("Bars"));
        expect(button("Defaults").isShown).toBe(true);
    });
});

describe("in a fight", () => {
    it("opens neither the settings nor the table, and says so", () => {
        const world = createPlayer();
        world.state.isInCombat = true;
        SlashCmdList["GLOWINGBARS"]!("settings", undefined as never);
        world.advance(1);
        SlashCmdList["GLOWINGBARS"]!("", undefined as never);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsOptions")!.isShown).toBe(false);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsLooks")?.isShown ?? false).toBe(false);
        expect(world.chat.filter((line) => line.includes("during combat")).length).toBe(2);
    });
});

describe("a fight that starts", () => {
    it("closes the settings and the table, and says so", () => {
        const world = createPlayer();
        world.openOptions();
        const settings = world.frames.find((frame) => frame.name === "GlowingBarsOptions")!;
        expect(settings.isShown).toBe(true);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        expect(settings.isShown).toBe(false);
        world.state.isInCombat = false;
        SlashCmdList["GLOWINGBARS"]!("", undefined as never);
        const table = world.frames.find((frame) => frame.name === "GlowingBarsLooks")!;
        expect(table.isShown).toBe(true);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        expect(table.isShown).toBe(false);
        expect(world.chat.filter((line) => line.includes("you entered combat")).length).toBe(2);
    });
});

describe("the button of Blizzard's Cooldown Manager", () => {
    it("opens Blizzard's window, and the settings stay open", () => {
        const world = createPlayer();
        world.openOptions();
        const settings = world.frames.find((frame) => frame.name === "GlowingBarsOptions")!;
        const button = world.frames.find((frame) => frame.frameType === "Button" && frame.text === "Open Blizzard's Cooldown Manager")!;
        button.scripts.OnClick!(button);
        expect(world.state.isViewerSettingsShown).toBe(true);
        expect(settings.isShown).toBe(true);
    });
});

describe("the Help tab", () => {
    it("has the link to the issues", () => {
        const world = createPlayer();
        expect(world.frames.some((frame) => (frame as unknown as { optionLabel?: string }).optionLabel === "Report an issue")).toBe(true);
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

describe("the choice on the Cooldown Manager tab", () => {
    it("counts at once, and always offers the reload", () => {
        const world = createPlayer(SHAMAN);
        world.openOptions();
        const label = "Your choice works after a reload";
        const shown = () =>
            world.frames.filter((frame) => (frame as unknown as { optionLabel?: string }).optionLabel === label && frame.isShown);
        expect(shown().length).toBe(2);
        world.setOption("cooldownManagerAccess", "readOnly");
        expect(world.getSavedSettings()?.cooldownManagerAccess).toBe("readOnly");
    });

    it("shows or hides a window at once, without a reload", () => {
        const world = createPlayer(SHAMAN);
        world.setOption("essentialIcons", "show");
        expect(world.getSavedSettings()?.essentialIcons).toBe("show");
        expect(world.state.reloads).toBe(0);
    });
});
