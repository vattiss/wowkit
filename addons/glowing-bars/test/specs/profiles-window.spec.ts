// The Profiles window (issue #76): opened at the top left of the settings, or by /gb profiles. It shows
// this character's own profile, and copies another's into it or resets it: each asks first, then reloads the interface.
import { createWorld, describe, expect, it, playAs, PRIEST, reloadWorld, type World } from "@wowkit/test-kit";

type Profiles = Record<string, Record<string, unknown> | undefined>;

function readAccount(world: World): { profiles?: Profiles } {
    return (world.getAccountSaved() ?? {}) as { profiles?: Profiles };
}

/** A priest on their own profile (moved from what they had), the account holding these profiles too; the window open. */
function openProfiles(otherProfiles: Profiles = {}, saved: Record<string, unknown> = { messageSize: 100 }): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.accountSaved = { profiles: { ...otherProfiles } };
    }, saved);
    world.advance(1);
    SlashCmdList.GLOWINGBARS!("profiles", undefined as never);
    world.advance(1);
    return world;
}

/** The answer to the question the window asks: its yes button (Copy, Reset) or Cancel. */
function answer(world: World, text: string): void {
    const box = world.frames.find((frame) => frame.name === "GlowingBarsProfilesQuestion")!;
    const button = world.frames.find((frame) => frame.parent === box && frame.text === text)!;
    button.scripts.OnClick!(button);
}

const isShown = (world: World) => world.frames.find((frame) => frame.name === "GlowingBarsProfiles")?.isShown === true;

describe("the Profiles window's buttons", () => {
    it("is opened from the top left of the settings window", () => {
        const world = createWorld((state) => playAs(state, PRIEST));
        world.advance(1);
        world.openOptions();
        const settings = world.frames.find((frame) => frame.name === "GlowingBarsOptions")!;
        const button = world.frames.find((frame) => frame.parent === settings && frame.text === "Profiles")!;
        button.scripts.OnClick!(button);
        world.advance(1);
        expect(isShown(world)).toBe(true);
    });

    it("says which profile this character uses", () => {
        const world = openProfiles();
        const row = world.frames.find((frame) => frame.fontStrings.some((text) => text.text === "Current profile"))!;
        expect(row.fontStrings.some((text) => text.text === "Me - Forever (Human Priest)")).toBe(true);
    });

    it("closes as a fight starts", () => {
        const world = openProfiles();
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        expect(isShown(world)).toBe(false);
    });
});

describe("the Profiles window's own buttons", () => {
    it("opens the settings from its top left", () => {
        const world = openProfiles();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsProfiles")!;
        const click = (text: string) => {
            const button = world.frames.find((frame) => frame.parent === window && frame.text === text)!;
            button.scripts.OnClick!(button);
            world.advance(1);
        };
        click("Settings");
        expect(world.frames.find((frame) => frame.name === "GlowingBarsOptions")?.isShown).toBe(true);
    });
});

describe("copying a profile", () => {
    it("does not copy this character's own profile into itself", () => {
        const world = openProfiles({ Shared: {} });
        world.setOption("copyProfile", "Me - Forever (Human Priest)");
        answer(world, "Copy");
        expect(world.state.reloads).toBe(0);
    });

    it("takes another profile's settings into this one, apart from it", () => {
        const world = openProfiles({ Shared: { messageSize: 150, styles: { missingBuff: { glowPercent: 40 } } } });
        world.setOption("copyProfile", "Shared");
        answer(world, "Copy");
        const profiles = readAccount(world).profiles!;
        expect(profiles["Me - Forever (Human Priest)"]?.messageSize).toBe(150);
        // A copy: changing it leaves the other as it was
        (profiles["Me - Forever (Human Priest)"]!.styles as Record<string, Record<string, unknown>>).missingBuff!.glowPercent = 90;
        expect((profiles.Shared!.styles as Record<string, Record<string, unknown>>).missingBuff!.glowPercent).toBe(40);
        expect(world.state.reloads).toBe(1);
    });
});

describe("resetting a profile", () => {
    it("puts this profile back to the defaults from the next load of the interface on, asked first", () => {
        const world = openProfiles({}, { messageSize: 150 });
        world.clickOption("Reset profile");
        answer(world, "Reset");
        expect(world.state.reloads).toBe(1);
        expect(reloadWorld(world).getSavedSettings()?.messageSize).toBe(100);
    });
});
