// Profiles (issue #76): the settings are kept by name for the whole account, one profile for each character. A character
// saved before profiles gets its own made of what it had, so nothing changes for it; a new character starts with the
// defaults. What a character learns as it plays, and a few switches of its own, stay in its own saved data.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type World } from "@wowkit/test-kit";
import { findAddRowOf, setUpWarrior, toggleTable } from "./table.helpers";

type Profiles = Record<string, Record<string, unknown> | undefined>;

/** The test kit's player GUID: what the account keeps a character's own settings by. */
const GUID = "Player-1-00000001";

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
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest)");
        expect(readProfiles(world)["Me - Forever (Human Priest)"]?.messageSize).toBe(150);
        expect(world.getSavedSettings()?.messageSize).toBe(150);
        expect(world.getSavedSettings()?.isDisabled).toBe(true);
    });

    it("keeps its own settings in its own data, not in the profile", () => {
        const world = createPriest({ messageSize: 150, isDisabled: true });
        expect(readProfiles(world)["Me - Forever (Human Priest)"]?.isDisabled).toBe(undefined);
        const character = world.getSavedSettings() as Record<string, unknown>;
        expect(character.isDisabled).toBe(true);
    });

    it("takes a number when a profile of its own name is there already", () => {
        const world = createPriest({ messageSize: 150 }, { profiles: { "Me - Forever (Human Priest)": { messageSize: 120 } } });
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest 2)");
        expect(readProfiles(world)["Me - Forever (Human Priest)"]?.messageSize).toBe(120);
        expect(world.getSavedSettings()?.messageSize).toBe(150);
    });
});

describe("a new character", () => {
    it("gets a profile of its own name, with the defaults", () => {
        const world = createWorld((state) => playAs(state, PRIEST), undefined, { isNewCharacter: true });
        world.advance(1);
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest)");
        expect(readProfiles(world)["Me - Forever (Human Priest)"] !== undefined).toBe(true);
        expect(world.getSavedSettings()?.messageSize).toBe(100);
    });
});

describe("a character on its own profile", () => {
    it("keeps it at its next login, under the name it got", () => {
        const world = createPriest({ profileName: "Mine" }, { profiles: { Mine: { messageSize: 150 } } });
        expect(world.getSavedSettings()?.profileName).toBe("Mine");
        expect(world.getSavedSettings()?.messageSize).toBe(150);
    });
});

describe("a character whose profile is gone", () => {
    it("gets one of its own again, with the defaults, when it holds nothing of a profile's", () => {
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
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest)");
        expect(world.getSavedSettings()?.messageSize).toBe(100);
    });

    it("gets one of its own again from the settings it still holds", () => {
        const world = createPriest({ profileName: "Raid", messageSize: 150 }, { profiles: {} });
        expect(world.getSavedSettings()?.profileName).toBe("Me - Forever (Human Priest)");
        expect(readProfiles(world)["Me - Forever (Human Priest)"]?.messageSize).toBe(150);
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
        expect(readCharacters(world)[GUID]?.addedSpells).toEqual(added);
        expect(readProfiles(world)["Me - Forever (Human Priest)"]?.addedSpells).toBe(undefined);
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
        expect(readCharacters(world)[GUID]?.addedSpells).toEqual([{ id: 72, reminderType: "readyCooldown" }]);
    });
});

describe("a character of a realm the client does not name (Forever)", () => {
    function createNoRealm(saved: Record<string, unknown>, accountSaved?: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            state.realm = "";
            state.accountSaved = accountSaved;
        }, saved);
        world.advance(1);
        return world;
    }

    it("gets a profile of its name alone", () => {
        const world = createNoRealm({ messageSize: 150 });
        expect(world.getSavedSettings()?.profileName).toBe("Me (Human Priest)");
        expect(readProfiles(world)["Me (Human Priest)"]?.messageSize).toBe(150);
    });
});

describe("characters of one name (Forever names no realm)", () => {
    /** A character named Me of no realm, with its own GUID and what it had saved, on the account given. */
    function login(guid: string, saved: Record<string, unknown>, accountSaved?: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            state.realm = "";
            state.playerGuid = guid;
            state.accountSaved = accountSaved;
        }, saved);
        world.advance(1);
        return world;
    }

    it("get profiles of their own: the name with the race and class, then numbered", () => {
        const first = login("Player-1-A", { messageSize: 110 });
        const second = login("Player-1-B", { messageSize: 120 }, first.getAccountSaved());
        const third = login("Player-1-C", { messageSize: 130 }, second.getAccountSaved());
        expect(third.getSavedSettings()?.profileName).toBe("Me (Human Priest 3)");
        const profiles = readProfiles(third);
        expect(profiles["Me (Human Priest)"]?.messageSize).toBe(110);
        expect(profiles["Me (Human Priest 2)"]?.messageSize).toBe(120);
        expect(profiles["Me (Human Priest 3)"]?.messageSize).toBe(130);
    });

    it("keep their added spells apart, each under its GUID", () => {
        const first = login("Player-1-A", { addedSpells: [{ id: 2512, reminderType: "lowStock" }] });
        const second = login("Player-1-B", { addedSpells: [{ id: 2515, reminderType: "lowStock" }] }, first.getAccountSaved());
        const characters = (second.getAccountSaved() as { characters: Record<string, { addedSpells?: { id: number }[] }> }).characters;
        expect(characters["Player-1-A"]?.addedSpells?.[0]?.id).toBe(2512);
        expect(characters["Player-1-B"]?.addedSpells?.[0]?.id).toBe(2515);
    });
});

describe("characters with a surname (Forever)", () => {
    function login(guid: string, surname: string, saved: Record<string, unknown>, accountSaved?: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            state.realm = "";
            state.playerGuid = guid;
            state.surname = surname;
            state.accountSaved = accountSaved;
        }, saved);
        world.advance(1);
        return world;
    }

    it("are named by their full name: one name with two surnames is two profiles, with no number", () => {
        const first = login("Player-1-A", "Brightwood", { messageSize: 110 });
        const second = login("Player-1-B", "Ashvale", { messageSize: 120 }, first.getAccountSaved());
        const profiles = readProfiles(second);
        expect(second.getSavedSettings()?.profileName).toBe("Me Ashvale (Human Priest)");
        expect(profiles["Me Brightwood (Human Priest)"]?.messageSize).toBe(110);
        expect(profiles["Me Ashvale (Human Priest)"]?.messageSize).toBe(120);
    });
});

describe("the realm's ruleset in a character's name (Forever)", () => {
    function login(guid: string, rules: string[], saved: Record<string, unknown>, accountSaved?: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            state.realm = "";
            state.playerGuid = guid;
            state.activeGameRules = rules;
            state.accountSaved = accountSaved;
        }, saved);
        world.advance(1);
        return world;
    }

    it("tells the same name apart by the ruleset, with no number", () => {
        const normal = login("Player-1-A", [], { messageSize: 110 });
        const pvp = login("Player-1-B", ["PvPRuleset"], { messageSize: 120 }, normal.getAccountSaved());
        const profiles = readProfiles(pvp);
        expect(pvp.getSavedSettings()?.profileName).toBe("Me (Human Priest, PvP)");
        expect(profiles["Me (Human Priest, Normal)"]?.messageSize).toBe(110);
        expect(profiles["Me (Human Priest, PvP)"]?.messageSize).toBe(120);
    });

    it("names Hardcore over the others, and both of PvP and RP together", () => {
        const hardcore = login("Player-1-A", ["HardcoreRuleset", "PvPRuleset"], { messageSize: 110 });
        const both = login("Player-1-B", ["PvPRuleset", "RPRuleset"], { messageSize: 120 }, hardcore.getAccountSaved());
        const profiles = readProfiles(both);
        expect(both.getSavedSettings()?.profileName).toBe("Me (Human Priest, RP PvP)");
        expect(profiles["Me (Human Priest, Hardcore)"]?.messageSize).toBe(110);
        expect(profiles["Me (Human Priest, RP PvP)"]?.messageSize).toBe(120);
    });

    it("numbers a taken name after the ruleset", () => {
        const first = login("Player-1-A", [], { messageSize: 110 });
        const second = login("Player-1-B", [], { messageSize: 120 }, first.getAccountSaved());
        expect(second.getSavedSettings()?.profileName).toBe("Me (Human Priest, Normal 2)");
    });
});
