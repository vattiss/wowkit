// The Proc rules tab of the table (beta): the switch of the new engine, the addon's rules switched off and on, the
// player's rules added, changed and taken out, and a group's row on the Procs tab with a look of its own.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    MAGE,
    PALADIN,
    playAs,
    WARRIOR,
    type FakeFrame,
    type World,
} from "@wowkit/test-kit";
import { findLabel, findRow, showTab, toggleTable } from "./table.helpers";

const REVENGE = { id: 6572, name: "Revenge", rank: 1, icon: 132353, isHarmful: true, cooldownSeconds: 5 };
const HOLY_STRIKE = { id: 407676, name: "Holy Strike", rank: 1, icon: 135891, isHarmful: true };
const HOLY_SHIELD = 20925;

/** The frame that made a text with these words, on the screen. */
function findFrameOf(world: World, words: string): FakeFrame | undefined {
    const isShown = (frame: FakeFrame | undefined): boolean => frame === undefined || (frame.isShown && isShown(frame.parent));
    return world.frames.find((frame) => isShown(frame) && frame.fontStrings.some((text) => text.text === words));
}

function listParts(world: World, frame: FakeFrame, frameType: string): FakeFrame[] {
    return world.frames.filter((other) => other.parent === frame && other.frameType === frameType);
}

function click(box: FakeFrame, isChecked?: boolean): void {
    if (isChecked !== undefined) box.isChecked = isChecked;
    box.scripts.OnClick!(box);
}

function openRules(world: World): void {
    toggleTable();
    showTab(world, "Proc rules");
}

function switchRulesOn(world: World): void {
    const holder = findFrameOf(world, "Use advanced proc rules (beta)")!;
    click(listParts(world, holder, "CheckButton")[0]!, true);
}

/** The widgets of the rule whose condition says these words. */
function findRule(world: World, condition: string): { priority: FakeFrame; group: FakeFrame; isOn: FakeFrame; remove: FakeFrame } {
    const row = findFrameOf(world, condition)!;
    const boxes = listParts(world, row, "EditBox");
    const buttons = listParts(world, row, "Button");
    return { priority: boxes[0]!, group: boxes[1]!, isOn: listParts(world, row, "CheckButton")[0]!, remove: buttons[1]! };
}

function enter(box: FakeFrame, text: string): void {
    box.text = text;
    box.scripts.OnEditFocusLost?.(box);
}

describe("the Proc rules tab", () => {
    function createWarrior(): World {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                learnSpell(state, REVENGE);
                state.bars[1] = REVENGE.id;
            },
            { shouldUseProcRules: false },
        );
        world.advance(1);
        openRules(world);
        return world;
    }

    it("lists the addon's rules faded while the switch is off, and changes nothing then", () => {
        const world = createWarrior();
        expect(findFrameOf(world, "Revenge")).toBeDefined();
        const rule = findRule(world, "After dodge");
        expect(rule.isOn.parent!.parent!.alpha).toBe(0.45);
        click(rule.isOn, false);
        expect(world.getSavedSettings()!.disabledProcRules).toEqual({});
    });

    it("switches the engine on, and an addon's rule off and on again", () => {
        const world = createWarrior();
        switchRulesOn(world);
        expect(world.getSavedSettings()!.shouldUseProcRules).toBe(true);
        click(findRule(world, "After dodge").isOn, false);
        expect((world.getSavedSettings()!.disabledProcRules as Record<string, boolean>)["6572:afterDodge"]).toBe(true);
        click(findRule(world, "After dodge").isOn, true);
        expect(world.getSavedSettings()!.disabledProcRules).toEqual({});
    });
});

describe("a rule of the player's in the Proc rules tab", () => {
    function createPaladin(): World {
        const world = createWorld((state) => {
            playAs(state, PALADIN);
            learnSpell(state, HOLY_STRIKE);
            state.spells[HOLY_SHIELD] = { id: HOLY_SHIELD, name: "Holy Shield", rank: 1, icon: 135880 };
            state.bars[1] = HOLY_STRIKE.id;
        });
        world.advance(1);
        openRules(world);
        switchRulesOn(world);
        return world;
    }

    function addRule(world: World, spellId: string, condition: string, buffId: string, group: string): void {
        const addRow = findFrameOf(world, "Add a rule")!;
        const [spell, buff, , groupBox] = listParts(world, addRow, "EditBox");
        const [conditionButton, , addButton] = listParts(world, addRow, "Button");
        world.pickFromMenu(conditionButton!, condition);
        spell!.text = spellId;
        buff!.text = buffId;
        groupBox!.text = group;
        click(addButton!);
    }

    it("is added by the add row, and lights its spell with its group's look", () => {
        const world = createPaladin();
        addRule(world, `${HOLY_STRIKE.id}`, "Buff up", `${HOLY_SHIELD}`, "shield");
        expect(world.getSavedSettings()!.procRules).toEqual([
            { spellId: HOLY_STRIKE.id, kind: "buff", value: HOLY_SHIELD, result: "glow", priority: 1, group: "shield" },
        ]);
        showTab(world, "Procs");
        const groupRow = findRow(world, "Holy Strike (shield)");
        enter(groupRow.glowPercent, "40");
        expect(
            (world.getSavedSettings()!.spellStyles as Record<string, { glowPercent?: number }>)["proc:Holy Strike (shield)"]?.glowPercent,
        ).toBe(40);
        world.state.auras.push(world.makeAura("Holy Shield", HOLY_SHIELD, 10));
        world.advance(2);
        expect(world.glowAlphasOn(1)).toEqual([0.4]);
    });

    it("refuses a spell the game does not know, and says so", () => {
        const world = createPaladin();
        addRule(world, "999999", "Usable", "", "");
        expect(world.getSavedSettings()!.procRules).toEqual([]);
        expect(world.chat[world.chat.length - 1]).toContain("No spell found with ID 999999");
    });

    it("changes its priority, and is taken out with its X", () => {
        const world = createPaladin();
        addRule(world, `${HOLY_STRIKE.id}`, "Buff up", `${HOLY_SHIELD}`, "");
        enter(findRule(world, "Buff up: Holy Shield").priority, "2");
        expect((world.getSavedSettings()!.procRules as { priority: number }[])[0]!.priority).toBe(2);
        click(findRule(world, "Buff up: Holy Shield").remove);
        expect(world.getSavedSettings()!.procRules).toEqual([]);
        expect(findLabel(world, "Holy Strike (shield)")).toBeUndefined();
    });
});

describe("the switches of the Procs and Proc rules tabs", () => {
    function createWarrior(saved: Record<string, unknown> = {}): World {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, REVENGE);
            state.bars[1] = REVENGE.id;
            state.unusableSpells[REVENGE.id] = true;
            state.isInCombat = true;
        }, saved);
        world.advance(1);
        return world;
    }

    it("switch a group's row off on the Procs tab: its rules light nothing, the others still do", () => {
        const world = createWarrior({
            shouldUseProcRules: true,
            disabledProcRules: { "6572:afterDodge": true },
            procRules: [{ spellId: REVENGE.id, kind: "afterDodge", result: "glow", priority: 1, group: "dodge" }],
        });
        toggleTable();
        showTab(world, "Procs");
        click(findRow(world, "Revenge (dodge)").enabled, false);
        expect((world.getSavedSettings()!.enabledSpells as Record<string, boolean>)["group:Revenge:dodge"]).toBe(false);
        world.fire("UNIT_COMBAT", "player", "DODGE", "", 0, 1);
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        world.fire("UNIT_COMBAT", "player", "BLOCK", "", 0, 1);
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("show the spells not learned yet: on Procs always offered, on Proc rules shown by default", () => {
        // A mage whose one proc, Arcane Missiles, is learned: no spell of the tab to show, the switch all the same
        const mage = createWorld((state) => {
            playAs(state, MAGE);
            learnSpell(state, { id: 5143, name: "Arcane Missiles", rank: 1, icon: 136096, isHarmful: true });
            state.bars[1] = 5143;
        });
        mage.advance(1);
        toggleTable();
        showTab(mage, "Procs");
        expect(findFrameOf(mage, "Show unlearned spells")).toBeDefined();
        toggleTable();
        const world = createWarrior();
        // Overpower is known to the game, not learned yet
        world.state.spells[7384] = { id: 7384, name: "Overpower", rank: 1, icon: 132223, isHarmful: true };
        toggleTable();
        showTab(world, "Proc rules");
        expect(findFrameOf(world, "Overpower")).toBeDefined();
    });
});

describe("the IDs and the Cooldown Manager on the Proc rules tab", () => {
    const RULE = { spellId: HOLY_STRIKE.id, kind: "buff", value: HOLY_SHIELD, result: "glow", priority: 1 };

    function openPaladin(saved: Record<string, unknown>, setUp?: (world: World) => void): World {
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, HOLY_STRIKE);
                state.spells[HOLY_SHIELD] = { id: HOLY_SHIELD, name: "Holy Shield", rank: 1, icon: 135880 };
                state.bars[1] = HOLY_STRIKE.id;
            },
            { shouldUseProcRules: true, isCooldownManagerSetUp: true, ...saved },
        );
        setUp?.(world);
        world.advance(1);
        openRules(world);
        return world;
    }

    /** The words of the rule's row whose condition says these. */
    function readRow(world: World, condition: string): string {
        return findFrameOf(world, condition)!
            .fontStrings.map((text) => text.text ?? "")
            .join(" | ");
    }

    it("shows the spell's ID under its name, and the buff's ID in its rule's row", () => {
        const world = openPaladin({ procRules: [RULE] });
        expect(findFrameOf(world, "Holy Strike")!.fontStrings.some((text) => text.text === String(HOLY_STRIKE.id))).toBe(true);
        expect(readRow(world, "Buff up: Holy Shield")).toContain(String(HOLY_SHIELD));
    });

    it("says where the buff stands with the Cooldown Manager", () => {
        const onList = (world: World) => world.state.buffCatalog.push({ spellId: HOLY_SHIELD, isHiddenByDefault: true });
        expect(readRow(openPaladin({ procRules: [RULE] }), "Buff up: Holy Shield")).toContain("no CDM");
        const byHand = openPaladin({ procRules: [RULE], cooldownManagerAccess: "readOnly" }, onList);
        expect(readRow(byHand, "Buff up: Holy Shield")).toContain("by hand");
        const reload = openPaladin({ procRules: [RULE], cooldownManagerAccess: "full" }, onList);
        expect(readRow(reload, "Buff up: Holy Shield")).toContain("/reload");
        const tracked = openPaladin({ procRules: [RULE] }, (world) =>
            world.state.trackedBuffs.push({ spellId: HOLY_SHIELD, isActive: false }),
        );
        expect(readRow(tracked, "Buff up: Holy Shield")).toContain("CDM|r");
    });

    it("says on adding a buff rule what the Cooldown Manager needs", () => {
        const world = openPaladin({ cooldownManagerAccess: "full" }, (each) =>
            each.state.buffCatalog.push({ spellId: HOLY_SHIELD, isHiddenByDefault: true }),
        );
        const addRow = findFrameOf(world, "Add a rule")!;
        const [spell, buff] = listParts(world, addRow, "EditBox");
        const [conditionButton, , addButton] = listParts(world, addRow, "Button");
        world.pickFromMenu(conditionButton!, "Buff up");
        spell!.text = String(HOLY_STRIKE.id);
        buff!.text = String(HOLY_SHIELD);
        click(addButton!);
        expect(world.chat[world.chat.length - 1]).toContain("Holy Shield: It goes into the Cooldown Manager's Tracked Buffs");
    });

    it("saves no group for a rule on the health, and shows the name its row gets, grey", () => {
        const world = openPaladin({});
        const addRow = findFrameOf(world, "Add a rule")!;
        const [spell, percent] = listParts(world, addRow, "EditBox");
        const [conditionButton, , addButton] = listParts(world, addRow, "Button");
        world.pickFromMenu(conditionButton!, "My health below");
        spell!.text = String(HOLY_STRIKE.id);
        percent!.text = "20";
        click(addButton!);
        expect((world.getSavedSettings()!.procRules as { group?: string }[])[0]!.group).toBe(undefined);
        const group = findRule(world, "My health below 20%").group;
        expect(group.fontStrings.some((text) => text.text === "my health below 20%" && text.isShown !== false)).toBe(true);
    });
});
