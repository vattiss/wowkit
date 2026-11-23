// The Added spells tab of the Profiles window (issue #76): every spell added on a character of the account, once. Add puts
// one on this character too; Delete, asked first, takes it off every character.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type FakeFrame, type World } from "@wowkit/test-kit";

const SHIELD_BASH = { id: 72, name: "Shield Bash", rank: 1, icon: 132357, cooldownSeconds: 12, isHarmful: true };
const BASH_ADDED = { id: 72, reminderType: "readyCooldown" };
const ARROWS_ADDED = { id: 2512, reminderType: "lowStock" };

type Characters = Record<string, { addedSpells?: unknown[] } | undefined>;

/** A character of its own GUID, with what it had added, on the account given; it logs in. */
function login(guid: string, addedSpells: unknown[], accountSaved?: Record<string, unknown>): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, SHIELD_BASH);
            state.itemNames[2512] = "Rough Arrow";
            state.playerGuid = guid;
            state.accountSaved = accountSaved;
        },
        { addedSpells },
    );
    world.advance(1);
    return world;
}

/** The first character added Shield Bash and arrows, the second (playing) nothing; the Profiles window open. */
function openOnSecond(secondAdded: unknown[] = []): World {
    const first = login("Player-1-A", [BASH_ADDED, ARROWS_ADDED]);
    const world = login("Player-1-B", secondAdded, first.getAccountSaved());
    SlashCmdList.GLOWINGBARS!("profiles", undefined as never);
    world.advance(1);
    return world;
}

const readCharacters = (world: World) => ((world.getAccountSaved() as { characters?: Characters }).characters ?? {}) as Characters;

/** The shown rows of the tab, by their labels. */
function listRows(world: World): string[] {
    return findRows(world).map((row) => row.fontStrings[0]!.text!);
}

function findRows(world: World): FakeFrame[] {
    const isSpellLabel = (text: string | undefined) => ["(Ready cooldown)", "(Low stock)"].some((type) => text?.endsWith(type) === true);
    return world.frames.filter((frame) => frame.isShown && isSpellLabel(frame.fontStrings[0]?.text));
}

/** The button of the row whose label has this name. */
function findButton(world: World, name: string, text: string): FakeFrame {
    const row = findRows(world).find((frame) => frame.fontStrings[0]!.text!.includes(name))!;
    return world.frames.find((frame) => frame.parent === row && frame.text === text)!;
}

function click(button: FakeFrame): void {
    button.scripts.OnClick!(button);
}

function answer(world: World, text: string): void {
    const box = world.frames.find((frame) => frame.name === "GlowingBarsProfilesQuestion")!;
    click(world.frames.find((frame) => frame.parent === box && frame.text === text)!);
}

describe("the spells added on the account's characters", () => {
    it("lists each spell once, with its type, whichever character added it", () => {
        const world = openOnSecond([BASH_ADDED]);
        const rows = listRows(world);
        expect(rows.length).toBe(2);
        expect(rows.some((label) => label.includes("Shield Bash (Ready cooldown)"))).toBe(true);
        expect(rows.some((label) => label.includes("Rough Arrow (Low stock)"))).toBe(true);
    });

    it("lists the spells of a character an earlier build kept, without its surname or ruleset", () => {
        const about = { name: "Old", realm: "", race: "Human", className: "Priest" };
        const world = login("Player-1-B", [], { characters: { "Player-1-A": { about, addedSpells: [BASH_ADDED] } } });
        SlashCmdList.GLOWINGBARS!("profiles", undefined as never);
        world.advance(1);
        expect(listRows(world).length).toBe(1);
    });

    it("adds a spell on this character only", () => {
        const world = openOnSecond();
        click(findButton(world, "Shield Bash", "Add"));
        const characters = readCharacters(world);
        expect(characters["Player-1-B"]?.addedSpells).toEqual([BASH_ADDED]);
        expect(characters["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED, ARROWS_ADDED]);
        expect(world.getSavedSettings()?.addedSpells).toEqual([BASH_ADDED]);
    });

    it("cannot add a spell this character has already", () => {
        const world = openOnSecond([BASH_ADDED]);
        expect(findButton(world, "Shield Bash", "Add").isEnabled).toBe(false);
        expect(findButton(world, "Rough Arrow", "Add").isEnabled).toBe(true);
    });

    it("deletes a spell from every character, asked first", () => {
        const world = openOnSecond([BASH_ADDED]);
        click(findButton(world, "Shield Bash", "Delete"));
        answer(world, "Delete");
        const characters = readCharacters(world);
        expect(characters["Player-1-A"]?.addedSpells).toEqual([ARROWS_ADDED]);
        expect(characters["Player-1-B"]?.addedSpells).toEqual([]);
        expect(listRows(world).length).toBe(1);
    });

    it("deletes nothing when the answer is no", () => {
        const world = openOnSecond([BASH_ADDED]);
        click(findButton(world, "Shield Bash", "Delete"));
        answer(world, "Cancel");
        expect(readCharacters(world)["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED, ARROWS_ADDED]);
        expect(listRows(world).length).toBe(2);
    });
});
