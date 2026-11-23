// Profiles (issue #76): the settings are kept by name for the whole account, and each character uses one. A character
// saved before profiles gets one of its own, made of what it had, so nothing changes for it; a new character starts on the
// Default profile. What a character learns as it plays, and a few switches of its own, stay in its own saved data.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type World } from "@wowkit/test-kit";
import { findAddRowOf, setUpWarrior, toggleTable } from "./table.helpers";

type Profiles = Record<string, Record<string, unknown> | undefined>;

function readProfiles(world: World): Profiles {
    return ((world.getAccountSaved() as { profiles?: Profiles } | undefined)?.profiles ?? {}) as Profiles;
}

/** A priest with these settings of their own saved, and the account's data as given. */
function createPriest(saved: Record<string, unknown> = {}, accountSaved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.accountSaved = accountSaved;
    }, saved);
    world.advance(1);
    return world;
}

describe("a character saved before profiles", () => {
    it("gets a profile of its own name, made of what it had: nothing changes", () => {
        const world = createPriest({ messageSize: 150, isDisabled: true });
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever");
        expect(readProfiles(world)["Me - Forever"]?.messageSize).toBe(150);
        expect(world.getSavedSettings()?.messageSize).toBe(150);
        expect(world.getSavedSettings()?.isDisabled).toBe(true);
    });

    it("keeps its own settings in its own data, not in the profile", () => {
        const world = createPriest({ messageSize: 150, isDisabled: true });
        expect(readProfiles(world)["Me - Forever"]?.isDisabled).toBe(undefined);
        const character = world.getSavedSettings() as Record<string, unknown>;
        expect(character.isDisabled).toBe(true);
    });

    it("takes another name when a profile of its own name is there already", () => {
        const world = createPriest({ messageSize: 150 }, { profiles: { "Me - Forever": { messageSize: 120 } } });
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (2)");
        expect(readProfiles(world)["Me - Forever"]?.messageSize).toBe(120);
        expect(world.getSavedSettings()?.messageSize).toBe(150);
    });
});

describe("a new character", () => {
    it("starts on the Default profile, with the defaults", () => {
        const world = createWorld((state) => playAs(state, PRIEST), undefined, { isNewCharacter: true });
        world.advance(1);
        expect(world.getSavedSettings()?.profileName).toBe("Default");
        expect(readProfiles(world).Default !== undefined).toBe(true);
        expect(world.getSavedSettings()?.messageSize).toBe(100);
    });
});

describe("two characters on one profile", () => {
    it("share a change: one made on either is the other's too", () => {
        const account = { profiles: { Shared: { messageSize: 150 } } };
        const first = createPriest({ profileName: "Shared" }, account);
        expect(first.getSavedSettings()?.messageSize).toBe(150);
        first.setOption("messageSize", 120);
        const second = createPriest({ profileName: "Shared" }, first.getAccountSaved());
        expect(second.getSavedSettings()?.messageSize).toBe(120);
    });

    it("keep each their own switch that turns the addon off", () => {
        const account = { profiles: { Shared: {} } };
        const first = createPriest({ profileName: "Shared", isDisabled: true }, account);
        expect(first.getSavedSettings()?.isDisabled).toBe(true);
        const second = createPriest({ profileName: "Shared" }, first.getAccountSaved());
        expect(second.getSavedSettings()?.isDisabled).toBe(false);
    });
});

describe("a character whose profile is gone", () => {
    it("goes back to the Default profile when it holds nothing of a profile's", () => {
        // Its saved data as it is, without the settings a test run may add to every character
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.accountSaved = { profiles: {} };
                (_G as unknown as Record<string, unknown>).GlowingBarsCharDB = { profileName: "Deleted", isWelcomeDone: true };
            },
            undefined,
            { isNewCharacter: true },
        );
        world.advance(1);
        expect(world.getSavedSettings()?.profileName).toBe("Default");
    });

    it("gets one again, under its old name, from the settings it still holds", () => {
        const world = createPriest({ profileName: "Raid", messageSize: 150 }, { profiles: {} });
        expect(world.getSavedSettings()?.profileName).toBe("Raid");
        expect(readProfiles(world).Raid?.messageSize).toBe(150);
    });
});

describe("a profile's settings, put right on loading", () => {
    it("drop a choice no longer known, as a character's did", () => {
        const world = createPriest({ profileName: "Shared" }, { profiles: { Shared: { fadedOpacity: 33 } } });
        expect(world.getSavedSettings()?.fadedOpacity).toBe(50);
        expect(readProfiles(world).Shared?.fadedOpacity).toBe(50);
    });
});

describe("the account's data", () => {
    it("keeps what else the addon saves there, beside the profiles", () => {
        const world = createPriest({}, { lastVersion: "4.0.0" });
        const account = world.getAccountSaved() as { profiles?: Profiles; lastVersion?: string };
        expect(account.profiles !== undefined).toBe(true);
        expect(account.lastVersion !== undefined).toBe(true);
    });
});

describe("the spells a character added by ID", () => {
    type Characters = Record<string, { addedSpells?: unknown[] } | undefined>;
    const readCharacters = (world: World) => ((world.getAccountSaved() as { characters?: Characters }).characters ?? {}) as Characters;

    it("move from the character's saved data into the account's, under its name, once", () => {
        const added = [{ id: 2512, reminderType: "lowStock" }];
        const world = createPriest({ addedSpells: added });
        expect(readCharacters(world)["Me - Forever"]?.addedSpells).toEqual(added);
        expect(readProfiles(world)["Me - Forever"]?.addedSpells).toBe(undefined);
        expect(((_G as unknown as Record<string, Record<string, unknown>>).GlowingBarsCharDB ?? {}).addedSpells).toBe(undefined);
        expect(world.getSavedSettings()?.addedSpells).toEqual(added);
    });

    it("are each character's own: another character's list is neither this one's nor changed by it", () => {
        const theirs = [{ id: 2512, reminderType: "lowStock" }];
        const world = createPriest({}, { characters: { "Alt - Forever": { addedSpells: theirs } } });
        expect(world.getSavedSettings()?.addedSpells).toEqual([]);
        expect(readCharacters(world)["Alt - Forever"]?.addedSpells).toEqual(theirs);
    });

    it("take a spell added in the table into the account's data, under this character", () => {
        const shieldBash = { id: 72, name: "Shield Bash", rank: 1, icon: 132357, cooldownSeconds: 12, isHarmful: true };
        const world = createWorld((state) => {
            setUpWarrior(state);
            learnSpell(state, shieldBash);
        });
        world.advance(1);
        toggleTable();
        const { box, add } = findAddRowOf(world);
        box.text = "72";
        add.scripts.OnClick!(add);
        toggleTable();
        expect(readCharacters(world)["Me - Forever"]?.addedSpells).toEqual([{ id: 72, reminderType: "readyCooldown" }]);
    });
});
