// The Before of a buff, a weapon buff and a seal (issue #80): how long before it runs out its reminder comes. Set for a type
// or a row in the table's Below column (15s, 30m, 1h); by default a buff once it is gone, Battle Shout 3 seconds before,
// a weapon buff 30 seconds before, a seal 1.5 seconds before.
import {
    BATTLE_SHOUT,
    createWorld,
    describe,
    expect,
    FORTITUDE,
    INSTANT_POISON,
    it,
    learnSpell,
    playAs,
    PRIEST,
    ROGUE,
    WARRIOR,
    type CharacterClass,
    type FakeFrame,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { findLabel, findLabelOnTab, readSaved, showTab, toggleTable } from "./table.helpers";

const MAIN_HAND = 16;
const OFF_HAND = 17;
const PALADIN: CharacterClass = { name: "Paladin", token: "PALADIN", id: 2 };
const CRUSADER: SpellDefinition = { id: 21082, name: "Seal of the Crusader", rank: 1, icon: 135924, isHelpful: true };

/** A warrior in a fight with Battle Shout on button 1, this many seconds left of it. */
function createWarrior(secondsLeft: number, saved: Record<string, unknown> = {}): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        learnSpell(state, BATTLE_SHOUT);
        state.bars[1] = BATTLE_SHOUT.id;
        state.isInCombat = true;
    }, saved);
    world.state.auras.push(world.makeAura(BATTLE_SHOUT.name, BATTLE_SHOUT.id, secondsLeft));
    world.advance(1);
    return world;
}

describe("the Before of a buff", () => {
    it("asks for Battle Shout 3 seconds before it runs out by default", () => {
        expect(createWarrior(5).glowsOn(1)).toBe(0);
        expect(createWarrior(3).glowsOn(1)).toBe(1);
    });

    it("asks for Battle Shout as early as its row says: 15 seconds", () => {
        const spellStyles = { "missingBuff:Battle Shout": { before: 15 } };
        expect(createWarrior(20, { spellStyles }).glowsOn(1)).toBe(0);
        expect(createWarrior(14, { spellStyles }).glowsOn(1)).toBe(1);
    });

    it("asks for every buff of the type as early as its Defaults row says, unless the buff's row has its own time", () => {
        const priest = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, FORTITUDE);
                state.bars[1] = FORTITUDE.id;
            },
            { styles: { missingBuff: { before: 30 } } },
        );
        priest.state.auras.push(priest.makeAura(FORTITUDE.name, FORTITUDE.id, 25));
        priest.advance(1);
        expect(priest.glowsOn(1)).toBe(1);
        // Battle Shout too: a change of its type takes over its own default, as for any part of a look
        expect(createWarrior(20, { styles: { missingBuff: { before: 30 } } }).glowsOn(1)).toBe(1);
        expect(
            createWarrior(20, {
                styles: { missingBuff: { before: 30 } },
                spellStyles: { "missingBuff:Battle Shout": { before: 5 } },
            }).glowsOn(1),
        ).toBe(0);
    });

    it("asks for a buff the player added as early as its type says", () => {
        const WARD: SpellDefinition = { id: 990002, name: "Ward of the Tester", rank: 1, icon: 1, isHelpful: true };
        const createWithWard = (saved: Record<string, unknown>) => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, WARD);
                    state.bars[1] = WARD.id;
                },
                { addedSpells: [{ id: WARD.id, reminderType: "missingBuff" }], ...saved },
            );
            world.state.auras.push(world.makeAura(WARD.name, WARD.id, 20));
            world.advance(1);
            return world;
        };
        expect(createWithWard({}).glowsOn(1)).toBe(0);
        expect(createWithWard({ styles: { missingBuff: { before: 30 } } }).glowsOn(1)).toBe(1);
    });
    it("counts down a shout cast while the game hides the buffs by the row's time too", () => {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                learnSpell(state, BATTLE_SHOUT);
                state.bars[1] = BATTLE_SHOUT.id;
                state.isInCombat = true;
                state.areAurasHidden = true;
            },
            { spellStyles: { "missingBuff:Battle Shout": { before: 60 } } },
        );
        world.advance(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", BATTLE_SHOUT.id);
        world.advance(110);
        expect(world.glowsOn(1)).toBe(0);
        // 59 seconds left of its 3 minutes
        world.advance(11);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("the Before of a weapon buff and of a seal", () => {
    /** A rogue with Instant Poison on 5: on the main hand, a minute left of it; an hour of it on the off-hand. */
    function createRogue(saved: Record<string, unknown> = {}): World {
        const world = createWorld((state) => {
            playAs(state, ROGUE);
            learnSpell(state, INSTANT_POISON);
            state.bars[5] = INSTANT_POISON.id;
            state.equippedItems[MAIN_HAND] = 1234;
            state.equippedItems[OFF_HAND] = 5678;
            state.enchants[MAIN_HAND] = { enchantID: 323, remainingTimeMs: 60000 };
            state.enchants[OFF_HAND] = { enchantID: 323, remainingTimeMs: 3600000 };
        }, saved);
        world.advance(4);
        return world;
    }

    it("asks for a poison 30 seconds before it runs out by default, earlier as its type says", () => {
        expect(createRogue().glowsOn(5)).toBe(0);
        expect(createRogue({ styles: { weaponBuff: { before: 120 } } }).glowsOn(5)).toBe(1);
    });

    it("asks for an added stone 30 seconds before it runs out too", () => {
        const world = createWorld(
            (state) => {
                playAs(state, ROGUE);
                state.spells[2828] = { id: 2828, name: "Sharpen Blade", rank: 1, icon: 135248, isHelpful: true };
                state.itemUseSpells[2862] = 2828;
                state.barItems[1] = 2862;
                state.bags[2862] = 5;
                state.equippedItems[MAIN_HAND] = 1234;
                state.temporaryEnchants[MAIN_HAND] = { enchantID: 14, remainingTimeMs: 20000 };
            },
            { addedSpells: [{ id: 2828, reminderType: "weaponBuff" }] },
        );
        world.advance(3);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("asks for a seal 1.5 seconds before it runs out by default, earlier as its row says", () => {
        const createPaladin = (secondsLeft: number, saved: Record<string, unknown> = {}) => {
            const world = createWorld((state) => {
                playAs(state, PALADIN);
                learnSpell(state, CRUSADER);
                state.bars[1] = CRUSADER.id;
                state.isInCombat = true;
            }, saved);
            world.state.auras.push(world.makeAura(CRUSADER.name, CRUSADER.id, secondsLeft));
            world.advance(1);
            return world;
        };
        expect(createPaladin(4).glowsOn(1)).toBe(0);
        expect(createPaladin(4, { spellStyles: { "missingSeal:Seal of the Crusader": { before: 5 } } }).glowsOn(1)).toBe(1);
    });
});

describe("the Before in the table's Below column", () => {
    /** The box of the Below column of the row with this label (the table is open on its tab). */
    function findBox(world: World, label: string): FakeFrame {
        const row = findLabel(world, label)!.parent;
        const boxes = world.frames.filter((frame) => frame.parent === row && frame.frameType === "EditBox" && frame.isShown);
        return boxes[boxes.length - 1]!;
    }

    function enter(box: FakeFrame, text: string): void {
        box.text = text;
        box.scripts.OnEditFocusLost!(box);
    }

    function openBuffs(): World {
        const world = createWarrior(100);
        toggleTable();
        showTab(world, "Buffs");
        return world;
    }

    it("is headed Before on the Buffs tab and Below on the Consumables tab", () => {
        const world = openBuffs();
        expect(findLabelOnTab(world, "Before")).toBeDefined();
        showTab(world, "Consumables");
        expect(findLabelOnTab(world, "Before")).toBeUndefined();
        toggleTable();
    });

    it("shows a time in its units, and keeps one typed in them", () => {
        const world = openBuffs();
        const box = findBox(world, "Battle Shout");
        expect(box.text).toBe("3s");
        enter(box, "1h30m");
        expect(readSaved(world, "spellStyles")["missingBuff:Battle Shout"]?.before).toBe(5400);
        expect(findBox(world, "Battle Shout").text).toBe("1h30m");
        toggleTable();
    });

    it("takes back the old time for what is no time, and 0 for an empty box", () => {
        const world = openBuffs();
        enter(findBox(world, "Battle Shout"), "abc");
        expect(findBox(world, "Battle Shout").text).toBe("3s");
        enter(findBox(world, "Battle Shout"), "");
        expect(readSaved(world, "spellStyles")["missingBuff:Battle Shout"]?.before).toBe(0);
        expect(findBox(world, "Battle Shout").text).toBe("");
        toggleTable();
    });

    it("sets the time of the whole type on its Defaults row", () => {
        const world = openBuffs();
        enter(findBox(world, "Missing buff"), "2m");
        expect(readSaved(world, "styles").missingBuff?.before).toBe(120);
        toggleTable();
    });
});

describe("a Before typed as no time", () => {
    it("takes back the old time for an endless number", () => {
        const world = createWarrior(100);
        toggleTable();
        showTab(world, "Buffs");
        const row = findLabel(world, "Battle Shout")!.parent;
        const boxes = world.frames.filter((frame) => frame.parent === row && frame.frameType === "EditBox" && frame.isShown);
        const box = boxes[boxes.length - 1]!;
        box.text = "inf";
        box.scripts.OnEditFocusLost!(box);
        expect(readSaved(world, "spellStyles")["missingBuff:Battle Shout"]).toBeUndefined();
        toggleTable();
    });
});
