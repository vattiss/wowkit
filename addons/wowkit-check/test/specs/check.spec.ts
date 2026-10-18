import { beforeEach, createWorld, describe, expect, it, learnSpell, FORTITUDE, type World } from "@wowkit/test-kit";

/** What the player types: /wowkit <text>. */
function typeCommand(text: string): void {
    SlashCmdList["WOWKITCHECK"]!(text, undefined as never);
}

interface SavedData {
    candidates: { [label: string]: string[] | undefined };
    checked: { spells: { [spellId: number]: string | undefined }; items: { [itemId: number]: string | undefined } };
}

/** The saved variable the check fills. */
function readSavedData(): SavedData {
    return (_G as unknown as Record<string, unknown>)["WowkitCheckDB"] as SavedData;
}

describe("the check of the IDs written in wow-data", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => learnSpell(state, FORTITUDE));
        world.advance(1);
        typeCommand("check");
        world.advance(5);
    });

    it("saves what the client says of an ID it knows", () => {
        expect(readSavedData().checked.spells[FORTITUDE.id]).toBe("Power Word: Fortitude|1");
    });

    it("saves an empty answer for an ID the client does not know, and says so", () => {
        expect(readSavedData().checked.spells[19740]).toBe("");
        expect(world.chat.some((line) => line.includes("NOT KNOWN TO THE CLIENT: Paladin.BlessingMight 19740"))).toBe(true);
    });

    it("asks about the reagent items too", () => {
        expect(readSavedData().checked.items[17028]).toBe("");
    });

    it("also runs when only /wowkit is typed", () => {
        typeCommand("");
        world.advance(5);
        expect(world.chat.filter((line) => line.includes("Checked ")).length).toBe(2);
    });
});

describe("the search for the real ID of an unknown one", () => {
    let world!: World;

    beforeEach(() => {
        // The client has Blessing of Light under another ID than the code says (19977)
        world = createWorld((state) => {
            learnSpell(state, { id: 99999, name: "Blessing of Light", rank: 1, icon: 1 });
            learnSpell(state, { id: 99998, name: "Holy Light", rank: 1, icon: 1 });
        });
        world.advance(1);
        typeCommand("check");
        world.advance(80);
    });

    it("finds the spells by the words of the name the code gives the ID, the one with the most words first", () => {
        expect(readSavedData().candidates["Paladin.BlessingLight"]).toEqual(["99999|Blessing of Light|1", "99998|Holy Light|1"]);
    });

    it("tells the player what it found", () => {
        expect(world.chat.some((line) => line.includes("Paladin.BlessingLight: 99999|Blessing of Light|1"))).toBe(true);
    });

    it("says when no spell has the name", () => {
        expect(world.chat.some((line) => line.includes("Mage.MageArmor: no spell with a word of that name"))).toBe(true);
    });
});
