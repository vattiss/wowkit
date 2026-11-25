// Going back to a build before profiles (4.4.0), and forward again: each logout leaves a copy of the profile's settings,
// and of the spells the character added, in its own saved data, where an older build reads them. At the next login that
// copy goes back into the profile, with what the older build changed; not into the account's lists, which another
// character may have changed meanwhile.
import { createWorld, describe, expect, it, playAs, PRIEST, type World } from "@wowkit/test-kit";

type Table = Record<string, unknown>;

/** The test kit's player GUID, and the name of its own profile. */
const GUID = "Player-1-00000001";
const OWN_PROFILE = "Me - Forever (Human Priest)";
const BASH_ADDED = { id: 72, reminderType: "readyCooldown" };

function login(saved: Table | undefined, accountSaved?: Table): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.accountSaved = accountSaved;
    }, saved);
    world.advance(1);
    return world;
}

/** What the game saves of the character at a logout: its own data, as an older build finds it. */
function logOut(world: World): Table {
    world.fire("PLAYER_LOGOUT");
    return (_G as unknown as Record<string, Table>).GlowingBarsCharDB!;
}

const readAccount = (world: World) =>
    world.getAccountSaved() as { profiles: Record<string, Table>; characters: Record<string, Table | undefined> };

describe("a build from before profiles, after this one", () => {
    it("finds the character's settings and added spells where it kept them", () => {
        const world = login({ messageSize: 150, addedSpells: [BASH_ADDED] });
        const saved = logOut(world);
        expect(saved.messageSize).toBe(150);
        expect(saved.addedSpells).toEqual([BASH_ADDED]);
    });
});

describe("this build again, after an older one", () => {
    it("keeps what the older build changed of the profile's settings", () => {
        const world = login({ messageSize: 150 });
        const saved = logOut(world);
        // The older build changes a setting where it keeps it
        saved.messageSize = 120;
        const again = login(saved, readAccount(world));
        expect(again.getSavedSettings()?.messageSize).toBe(120);
        expect(readAccount(again).profiles[OWN_PROFILE]?.messageSize).toBe(120);
        // In the profile again, not left in the character's own data as well
        expect((_G as unknown as Record<string, Table>).GlowingBarsCharDB!.messageSize).toBe(undefined);
    });

    it("does not bring back an added spell another character deleted from all of them meanwhile", () => {
        const world = login({ addedSpells: [BASH_ADDED] });
        const saved = logOut(world);
        const account = readAccount(world);
        account.characters[GUID]!.addedSpells = [];
        const again = login(saved, account);
        expect(again.getSavedSettings()?.addedSpells).toEqual([]);
    });
});
