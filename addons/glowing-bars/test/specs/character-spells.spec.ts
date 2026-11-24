// The Added spells window (issue #76): every spell added on a character of the account, once. Add and
// Remove change this character's list; Characters shows which ones have it, and deletes it from all of them.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, type FakeFrame, type World } from "@wowkit/test-kit";
import { toggleTable } from "./table.helpers";

const SHIELD_BASH = { id: 72, name: "Shield Bash", rank: 1, icon: 132357, cooldownSeconds: 12, isHarmful: true };
const BASH_ADDED = { id: 72, reminderType: "readyCooldown" };
const ARROWS_ADDED = { id: 2512, reminderType: "lowStock" };

type Characters = Record<string, { addedSpells?: unknown[]; fedItems?: Record<string, number> } | undefined>;

/**
 * A character of its own GUID, with what it had added (and saved besides), on the account given; it logs in. The client
 * knows the arrows' and the steak's names, but for those of `loadingItems`.
 */
function login(
    guid: string,
    addedSpells: unknown[],
    accountSaved?: Record<string, unknown>,
    saved: Record<string, unknown> = {},
    loadingItems: number[] = [],
): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, SHIELD_BASH);
            if (!loadingItems.includes(2512)) state.itemNames[2512] = "Rough Arrow";
            state.spells[18233] = { id: 18233, name: "Nutritious Food", rank: 1, icon: 1 };
            if (!loadingItems.includes(13935)) state.itemNames[13935] = "Tender Wolf Steak";
            state.playerGuid = guid;
            // The first one's surname lists it after the second, so the order of the list cannot name a spell by its adder
            if (guid === "Player-1-A") state.surname = "Stormlight";
            state.accountSaved = accountSaved;
        },
        { ...saved, addedSpells },
    );
    world.advance(1);
    return world;
}

/** Opens the Added spells window by the button at the top left of the table. */
function openAddedSpells(world: World): void {
    toggleTable();
    const table = world.frames.find((frame) => frame.name === "GlowingBarsLooks")!;
    click(world.frames.find((frame) => frame.parent === table && frame.text === "Added spells")!);
}

/** The first character added Shield Bash and arrows, the second (playing) nothing; the Added spells window open. */
function openOnSecond(secondAdded: unknown[] = []): World {
    const first = login("Player-1-A", [BASH_ADDED, ARROWS_ADDED]);
    const world = login("Player-1-B", secondAdded, first.getAccountSaved());
    openAddedSpells(world);
    world.advance(1);
    return world;
}

const readCharacters = (world: World) => ((world.getAccountSaved() as { characters?: Characters }).characters ?? {}) as Characters;

/** The shown rows of the tab, by their labels. */
function listRows(world: World): string[] {
    return findRows(world).map((row) => row.fontStrings[0]!.text!);
}

function findRows(world: World): FakeFrame[] {
    const isSpellLabel = (text: string | undefined) =>
        ["(Ready cooldown)", "(Low stock)", "(Missing buff)"].some((type) => text?.endsWith(type) === true);
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

function findQuestionBox(world: World): FakeFrame {
    return world.frames.find((frame) => frame.name === "GlowingBarsAddedSpellsQuestion")!;
}

function answer(world: World, text: string): void {
    const box = findQuestionBox(world);
    click(world.frames.find((frame) => frame.parent === box && frame.text === text)!);
}

/** Is the window asking something? */
const isAsking = (world: World) => findQuestionBox(world).parent?.isShown === true;

describe("the Added spells window", () => {
    it("is opened from the top left of the table, which closes for it; not by a command", () => {
        const world = login("Player-1-A", [BASH_ADDED]);
        openAddedSpells(world);
        world.advance(1);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsAddedSpells")?.isShown).toBe(true);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsLooks")?.isShown).toBe(false);
        expect(listRows(world).length).toBe(1);
        world.frames.find((frame) => frame.name === "GlowingBarsAddedSpells")!.isShown = false;
        SlashCmdList.GLOWINGBARS!("spells", undefined as never);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsAddedSpells")?.isShown).toBe(false);
    });
});

describe("the Added spells window's own button", () => {
    it("opens the table again from its top left", () => {
        const world = openOnSecond();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsAddedSpells")!;
        const button = world.frames.find((frame) => frame.parent === window && frame.text === "Open Table")!;
        click(button);
        world.advance(1);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsLooks")?.isShown).toBe(true);
        // On the left: set in from the left edge, not back from the right one
        expect((button.anchorX ?? 0) > 0).toBe(true);
    });

    it("leaves the table open when it was opened meanwhile", () => {
        const world = openOnSecond();
        toggleTable();
        const window = world.frames.find((frame) => frame.name === "GlowingBarsAddedSpells")!;
        click(world.frames.find((frame) => frame.parent === window && frame.text === "Open Table")!);
        world.advance(1);
        expect(world.frames.find((frame) => frame.name === "GlowingBarsLooks")?.isShown).toBe(true);
    });
});

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
        openAddedSpells(world);
        world.advance(1);
        expect(listRows(world).length).toBe(1);
    });

    it("names a food by its item, as the table does, not by the spell all foods share", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                state.spells[18233] = { id: 18233, name: "Nutritious Food", rank: 1, icon: 1 };
                state.itemUseSpells[13935] = 18233;
                state.itemNames[13935] = "Tender Wolf Steak";
                state.barItems[1] = 13935;
                state.bags[13935] = 5;
            },
            { addedSpells: [{ id: 18233, reminderType: "missingBuff" }] },
        );
        world.advance(1);
        openAddedSpells(world);
        world.advance(1);
        expect(listRows(world).some((label) => label.includes("Tender Wolf Steak (Missing buff)"))).toBe(true);
    });

    it("names a food another character added by the item that character ate", () => {
        const food = { id: 18233, reminderType: "missingBuff" };
        const first = login("Player-1-A", [food], undefined, { fedItems: { "18233": 13935 } });
        const world = login("Player-1-B", [], first.getAccountSaved());
        openAddedSpells(world);
        world.advance(1);
        const rows = listRows(world);
        expect(rows.length).toBe(1);
        expect(rows[0]!.endsWith(" Tender Wolf Steak (Missing buff)")).toBe(true);
    });

    it("still names a food another character added by its item once this one adds it too", () => {
        const food = { id: 18233, reminderType: "missingBuff" };
        const first = login("Player-1-A", [food], undefined, { fedItems: { "18233": 13935 } });
        const world = login("Player-1-B", [], first.getAccountSaved());
        openAddedSpells(world);
        world.advance(1);
        click(findButton(world, "Tender Wolf Steak", "Add"));
        expect(listRows(world)[0]!.endsWith(" Tender Wolf Steak (Missing buff)")).toBe(true);
    });

    it("gives this character the item of a food it adds, for its own table", () => {
        const food = { id: 18233, reminderType: "missingBuff" };
        const first = login("Player-1-A", [food], undefined, { fedItems: { "18233": 13935 } });
        const world = login("Player-1-B", [], first.getAccountSaved(), { fedItems: { "2828": 2862 } });
        openAddedSpells(world);
        world.advance(1);
        click(findButton(world, "Tender Wolf Steak", "Add"));
        expect(readCharacters(world)["Player-1-B"]?.fedItems).toEqual({ "18233": 13935, "2828": 2862 });
    });

    it("names an item the client had not loaded once its data comes in", () => {
        const first = login("Player-1-A", [ARROWS_ADDED]);
        const world = login("Player-1-B", [], first.getAccountSaved(), {}, [2512]);
        openAddedSpells(world);
        world.advance(1);
        expect(listRows(world)).toEqual(["#2512 (Low stock)"]);
        world.state.itemNames[2512] = "Rough Arrow";
        world.fire("GET_ITEM_INFO_RECEIVED", 2512, true);
        expect(listRows(world)).toEqual(["Rough Arrow (Low stock)"]);
    });

    it("asks the client for an item once, so its answer does not ask again", () => {
        const first = login("Player-1-A", [ARROWS_ADDED]);
        const world = login("Player-1-B", [], first.getAccountSaved(), {}, [2512]);
        openAddedSpells(world);
        world.advance(1);
        world.fire("GET_ITEM_INFO_RECEIVED", 2512, false);
        world.fire("GET_ITEM_INFO_RECEIVED", 2512, false);
        expect(world.state.itemLoadRequests).toEqual([2512]);
    });

    it("names this character's own food by its item once the client loads it", () => {
        const food = { id: 18233, reminderType: "missingBuff" };
        const world = login("Player-1-A", [food], undefined, { fedItems: { "18233": 13935 } }, [13935]);
        openAddedSpells(world);
        world.advance(1);
        world.state.itemNames[13935] = "Tender Wolf Steak";
        world.fire("GET_ITEM_INFO_RECEIVED", 13935, true);
        expect(listRows(world)[0]!.endsWith(" Tender Wolf Steak (Missing buff)")).toBe(true);
    });

    it("adds a spell on this character only", () => {
        const world = openOnSecond();
        click(findButton(world, "Shield Bash", "Add"));
        const characters = readCharacters(world);
        expect(characters["Player-1-B"]?.addedSpells).toEqual([BASH_ADDED]);
        expect(characters["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED, ARROWS_ADDED]);
        expect(world.getSavedSettings()?.addedSpells).toEqual([BASH_ADDED]);
    });

    it("offers Remove for a spell this character has, Add for one it has not", () => {
        const world = openOnSecond([BASH_ADDED]);
        expect(findButton(world, "Shield Bash", "Remove") !== undefined).toBe(true);
        expect(findButton(world, "Rough Arrow", "Add") !== undefined).toBe(true);
    });

    it("removes a spell from this character only, and keeps its row while another has it", () => {
        const world = openOnSecond([BASH_ADDED, ARROWS_ADDED]);
        click(findButton(world, "Shield Bash", "Remove"));
        expect(isAsking(world)).toBe(false);
        const characters = readCharacters(world);
        expect(characters["Player-1-B"]?.addedSpells).toEqual([ARROWS_ADDED]);
        expect(characters["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED, ARROWS_ADDED]);
        expect(findButton(world, "Shield Bash", "Add") !== undefined).toBe(true);
    });

    it("asks before removing a spell no other character has, and its row leaves", () => {
        const world = login("Player-1-A", [BASH_ADDED]);
        openAddedSpells(world);
        world.advance(1);
        click(findButton(world, "Shield Bash", "Remove"));
        expect(readCharacters(world)["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED]);
        answer(world, "Remove");
        expect(readCharacters(world)["Player-1-A"]?.addedSpells).toEqual([]);
        expect(listRows(world)).toEqual([]);
    });

    it("shows which characters have a spell", () => {
        const world = openOnSecond([BASH_ADDED]);
        click(findButton(world, "Shield Bash", "Characters"));
        const words = findQuestionBox(world).fontStrings[0]!.text!;
        expect(words.includes("Shield Bash is added on:")).toBe(true);
        expect(words.includes("Me Stormlight")).toBe(true);
        // The heading, an empty line, and the two characters
        expect(words.split("\n").length).toBe(4);
    });

    it("names at most 15 characters, and counts the rest", () => {
        const characters: Characters = {};
        for (let n = 1; n <= 17; n++) {
            const about = { name: `Alt${n}`, surname: "", realm: "", race: "Human", className: "Priest", ruleset: "" };
            characters[`Player-1-${n}`] = { about, addedSpells: [BASH_ADDED] } as Characters[string];
        }
        const world = login("Player-1-B", [], { characters });
        openAddedSpells(world);
        world.advance(1);
        click(findButton(world, "Shield Bash", "Characters"));
        const lines = findQuestionBox(world).fontStrings[0]!.text!.split("\n");
        // The heading, an empty line, 15 characters and the count
        expect(lines.length).toBe(18);
        expect(lines[17]).toBe("...and 2 more");
    });

    it("deletes a spell from every character from there", () => {
        const world = openOnSecond([BASH_ADDED]);
        click(findButton(world, "Shield Bash", "Characters"));
        answer(world, "Delete from all characters");
        const characters = readCharacters(world);
        expect(characters["Player-1-A"]?.addedSpells).toEqual([ARROWS_ADDED]);
        expect(characters["Player-1-B"]?.addedSpells).toEqual([]);
        expect(listRows(world).length).toBe(1);
    });

    it("deletes nothing when that is cancelled", () => {
        const world = openOnSecond([BASH_ADDED]);
        click(findButton(world, "Shield Bash", "Characters"));
        answer(world, "Cancel");
        expect(readCharacters(world)["Player-1-A"]?.addedSpells).toEqual([BASH_ADDED, ARROWS_ADDED]);
        expect(listRows(world).length).toBe(2);
    });
});
