// The Profiles window (issue #76): opened at the top left of the settings. It shows
// this character's own profile, and copies another's into it or resets it: each asks first, then asks for a /reload.
import { createWorld, describe, expect, it, playAs, PRIEST, reloadWorld, type World } from "@wowkit/test-kit";
import { openProfilesWindow } from "./profiles.helpers";

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
    openProfilesWindow(world);
    return world;
}

/** The answer to the question the window asks: its yes button (Copy, Reset) or Cancel. */
function answer(world: World, text: string): void {
    const box = world.frames.find((frame) => frame.name === "GlowingBarsProfilesQuestion")!;
    const button = world.frames.find((frame) => frame.parent === box && frame.text === text)!;
    button.scripts.OnClick!(button);
}

const asksForReload = (world: World) => world.chat.some((line) => line.includes("type /reload"));

/** The row that reloads the interface, by its label. */
const findReloadRow = (world: World) =>
    world.frames.find((frame) => frame.fontStrings.some((text) => text.text === "Load the new settings"))!;

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

    it("shows no tab button: it has only the one tab", () => {
        const world = openProfiles();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsProfiles")!;
        expect(world.frames.some((frame) => frame.parent === window && frame.text === "Profiles" && frame.isShown)).toBe(false);
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
        expect(asksForReload(world)).toBe(false);
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
        // A reload is tried; where Forever blocks it, the player is asked for one
        expect(world.state.reloads).toBe(1);
        expect(asksForReload(world)).toBe(true);
    });
});

describe("resetting a profile", () => {
    it("puts this profile back to the defaults from the next load of the interface on, asked first", () => {
        const world = openProfiles({}, { messageSize: 150 });
        world.clickOption("Reset profile");
        answer(world, "Reset");
        expect(world.state.reloads).toBe(1);
        expect(asksForReload(world)).toBe(true);
        expect(reloadWorld(world).getSavedSettings()?.messageSize).toBe(100);
    });
});

describe("reloading after a change", () => {
    it("is offered only once the profile was copied or reset, and reloads by its own click", () => {
        const world = openProfiles({}, { messageSize: 150 });
        expect(findReloadRow(world).isShown).toBe(false);
        world.clickOption("Reset profile");
        answer(world, "Reset");
        const row = findReloadRow(world);
        expect(row.isShown).toBe(true);
        const button = world.frames.find((frame) => frame.parent === row && frame.text === "Reload")!;
        button.scripts.OnClick!(button);
        expect(world.state.reloads).toBe(2);
    });
});

describe("deleting a profile", () => {
    const ALT_GUID = "Player-1-00000002";
    const ALT_ABOUT = { name: "Alt", surname: "", realm: "Forever", race: "Gnome", className: "Mage", ruleset: "" };

    /** A priest whose account holds the profile of a deleted character, Alt, and its entry with a spell it added. */
    function openWithAlt(): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            state.accountSaved = {
                profiles: { Alt: { messageSize: 150 } },
                characters: {
                    [ALT_GUID]: { profileName: "Alt", about: ALT_ABOUT, addedSpells: [{ id: 72, reminderType: "readyCooldown" }] },
                },
            };
        });
        world.advance(1);
        openProfilesWindow(world);
        return world;
    }

    const readCharacters = (world: World) => (world.getAccountSaved() as { characters: Record<string, unknown> }).characters;

    it("deletes another character's profile, asked first, with no reload; its added spells stay", () => {
        const world = openWithAlt();
        world.setOption("deleteProfile", "Alt");
        answer(world, "Delete");
        expect(readAccount(world).profiles!.Alt).toBe(undefined);
        expect(readCharacters(world)[ALT_GUID] !== undefined).toBe(true);
        expect(readAccount(world).profiles!["Me - Forever (Human Priest)"] !== undefined).toBe(true);
        expect(world.state.reloads).toBe(0);
    });

    it("keeps it when that is cancelled", () => {
        const world = openWithAlt();
        world.setOption("deleteProfile", "Alt");
        answer(world, "Cancel");
        expect(readAccount(world).profiles!.Alt?.messageSize).toBe(150);
        expect(readCharacters(world)[ALT_GUID] !== undefined).toBe(true);
    });

    it("never deletes this character's own profile", () => {
        const world = openWithAlt();
        world.setOption("deleteProfile", "Me - Forever (Human Priest)");
        answer(world, "Delete");
        expect(readAccount(world).profiles!["Me - Forever (Human Priest)"] !== undefined).toBe(true);
    });
});
