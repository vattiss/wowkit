// The Profiles window (issue #76): opened at the top left of the settings and of the table, or by /gb profiles. It shows the
// profile this character uses, and switches, makes, copies, renames, deletes and resets profiles; what takes effect at the
// next load of the interface asks first, then reloads it.
import { createWorld, describe, expect, it, playAs, PRIEST, reloadWorld, type World } from "@wowkit/test-kit";
import { toggleTable } from "./table.helpers";

type Profiles = Record<string, Record<string, unknown> | undefined>;

function readAccount(world: World): { profiles?: Profiles; renamedProfiles?: Record<string, string | undefined> } {
    return (world.getAccountSaved() ?? {}) as { profiles?: Profiles; renamedProfiles?: Record<string, string | undefined> };
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

/** The answer to the question the window asks: its yes button (Switch, Create...) or Cancel. */
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

    it("is opened from the top left of the table", () => {
        const world = createWorld((state) => playAs(state, PRIEST));
        world.advance(1);
        toggleTable();
        const table = world.frames.find((frame) => frame.name === "GlowingBarsLooks")!;
        const button = world.frames.find((frame) => frame.parent === table && frame.text === "Profiles")!;
        button.scripts.OnClick!(button);
        world.advance(1);
        expect(isShown(world)).toBe(true);
        expect(table.isShown).toBe(false);
    });

    it("says which profile this character uses", () => {
        const world = openProfiles();
        expect(
            world.frames.some((frame) =>
                frame.fontStrings.some((text) => text.text?.includes("uses the Me - Forever (Human Priest) profile")),
            ),
        ).toBe(true);
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
    it("opens the settings from its top left, and the table from its top right", () => {
        const world = openProfiles();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsProfiles")!;
        const click = (text: string) => {
            const button = world.frames.find((frame) => frame.parent === window && frame.text === text)!;
            button.scripts.OnClick!(button);
            world.advance(1);
        };
        click("Settings");
        expect(world.frames.find((frame) => frame.name === "GlowingBarsOptions")?.isShown).toBe(true);
        SlashCmdList.GLOWINGBARS!("profiles", undefined as never);
        world.advance(1);
        click("Open Table");
        expect(world.frames.find((frame) => frame.name === "GlowingBarsLooks")?.isShown).toBe(true);
    });
});

describe("switching profiles", () => {
    it("asks first, then uses the profile picked from the next load of the interface on", () => {
        const world = openProfiles({ Shared: { messageSize: 150 } });
        world.setOption("profile", "Shared");
        expect(world.state.reloads).toBe(0);
        answer(world, "Switch");
        expect(world.state.reloads).toBe(1);
        expect(reloadWorld(world).getSavedSettings()?.messageSize).toBe(150);
    });

    it("changes nothing when the answer is no", () => {
        const world = openProfiles({ Shared: { messageSize: 150 } });
        world.setOption("profile", "Shared");
        answer(world, "Cancel");
        expect(world.state.reloads).toBe(0);
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest)");
    });
});

describe("making a profile", () => {
    it("makes one with the defaults, and switches to it, asked first", () => {
        const world = openProfiles();
        world.setOption("newProfile", "Raid");
        answer(world, "Create");
        expect(readAccount(world).profiles?.Raid !== undefined).toBe(true);
        expect(world.state.reloads).toBe(1);
        expect(reloadWorld(world).getSavedSettings()?.profileName).toBe("Raid");
    });

    it("says so for a name that is taken, and makes none", () => {
        const world = openProfiles({ Shared: {} });
        world.setOption("newProfile", "Shared");
        expect(world.chat.some((line) => line.includes("Pick another name"))).toBe(true);
        expect(world.state.reloads).toBe(0);
    });
});

describe("copying a profile", () => {
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

describe("renaming a profile", () => {
    it("renames this character's, and a character on the old name follows it at its next login", () => {
        const world = openProfiles();
        world.setOption("renameProfile", "Main");
        const account = readAccount(world);
        expect(account.profiles?.Main !== undefined).toBe(true);
        expect(account.profiles?.["Me - Forever (Human Priest)"]).toBe(undefined);
        expect(world.getSavedSettings()?.profileName).toBe("Main");
        const other = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.accountSaved = account;
            },
            { profileName: "Me - Forever (Human Priest)" },
        );
        other.advance(1);
        expect(other.getSavedSettings()?.profileName).toBe("Main");
    });
});

describe("deleting a profile", () => {
    it("deletes another profile, asked first", () => {
        const world = openProfiles({ Shared: {} });
        world.setOption("deleteProfile", "Shared");
        answer(world, "Delete");
        expect(readAccount(world).profiles?.Shared).toBe(undefined);
    });

    it("does not delete this character's own", () => {
        const world = openProfiles();
        world.setOption("deleteProfile", "Me - Forever (Human Priest)");
        answer(world, "Delete");
        expect(readAccount(world).profiles?.["Me - Forever (Human Priest)"] !== undefined).toBe(true);
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
