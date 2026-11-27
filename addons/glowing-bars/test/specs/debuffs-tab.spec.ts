// The Debuffs tab (beta): its switch (off by default, everything under it faded and locked while off), the class's own
// debuffs listed without adding them (a hunter's stings and mark, a priest's Shadow Word: Pain), and its purple look.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    PRIEST,
    targetEnemy,
    type FakeFrame,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { findLabel, showTab, switchInTable, toggleTable } from "./table.helpers";
import { cast, createHunter, hideDebuffs, HUNTERS_MARK, SERPENT_STING } from "./missing-debuff.helpers";

describe("the Debuffs tab (beta)", () => {
    /** The rows of the tab shown that name this spell. */
    const countRows = (world: World, label: string) =>
        world.frames.filter(
            (frame) =>
                frame.isShown &&
                frame.fontStrings.some((text) => text.text === label) &&
                world.frames.some((other) => other.parent === frame && other.frameType === "CheckButton"),
        ).length;

    it("reminds of nothing while its switch is off, as it is by default", () => {
        expect(createHunter({ shouldUseDebuffs: false }).glowsOn(1)).toBe(0);
    });

    it("is switched on by its switch at the top of the tab", () => {
        const world = createHunter({ shouldUseDebuffs: false });
        toggleTable();
        showTab(world, "Debuffs");
        const holder = world.frames.find(
            (frame) => frame.isShown && frame.fontStrings.some((text) => text.text === "Use debuff reminders (beta)"),
        )!;
        const box = world.frames.find((frame) => frame.parent === holder && frame.frameType === "CheckButton")!;
        box.isChecked = true;
        box.scripts.OnClick!(box);
        expect(world.getSavedSettings()?.shouldUseDebuffs).toBe(true);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("is faded under its switch while it is off, a cover over the rows saying why; full again once on", () => {
        const world = createHunter({ shouldUseDebuffs: false });
        toggleTable();
        showTab(world, "Debuffs");
        const findRowFrame = () => findLabel(world, SERPENT_STING.name)!.parent!;
        const findSwitch = () =>
            world.frames.find((frame) => frame.isShown && frame.fontStrings.some((text) => text.text === "Use debuff reminders (beta)"))!;
        expect(findRowFrame().alpha).toBe(0.45);
        expect(findSwitch().alpha).toBe(1);
        const cover = world.frames.find(
            // Under the switch, anchored to it
            (frame) => frame.isShown && frame.anchor === findSwitch() && frame.scripts.OnEnter !== undefined,
        )!;
        cover.scripts.OnEnter!(cover);
        expect(world.findFrame((frame) => frame.name === "GameTooltip")?.text).toBe(
            "Switch on Use debuff reminders (beta) to change the debuffs.",
        );
        const box = world.frames.find((frame) => frame.parent === findSwitch() && frame.frameType === "CheckButton")!;
        box.isChecked = true;
        box.scripts.OnClick!(box);
        expect(findRowFrame().alpha).toBe(1);
        expect(cover.isShown).toBe(false);
    });

    it("leaves the other tabs unfaded after it was shown faded", () => {
        const world = createHunter({ shouldUseDebuffs: false });
        toggleTable();
        showTab(world, "Debuffs");
        showTab(world, "Cooldowns");
        expect(world.frames.filter((frame) => frame.isShown && frame.alpha === 0.45).length).toBe(0);
    });

    it("has a hunter's Serpent Sting and Hunter's Mark without adding them", () => {
        const world = createHunter({ addedSpells: [] });
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
        toggleTable();
        showTab(world, "Debuffs");
        expect(countRows(world, SERPENT_STING.name)).toBe(1);
        expect(countRows(world, HUNTERS_MARK.name)).toBe(1);
    });

    it("has one row for a debuff both listed and added", () => {
        const world = createHunter();
        toggleTable();
        showTab(world, "Debuffs");
        expect(countRows(world, SERPENT_STING.name)).toBe(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("names a debuff both listed and added once in the message", () => {
        const world = createHunter({ styles: { missingDebuff: { isMessageOn: true, messageTextChoice: "typeAndName" } } });
        world.advance(1);
        const [, count] = string.gsub(world.notice(), SERPENT_STING.name, "");
        expect(count).toBe(1);
    });

    it("lets a listed debuff be switched off in its row", () => {
        const world = createHunter({ addedSpells: [] });
        toggleTable();
        showTab(world, "Debuffs");
        switchInTable(world, SERPENT_STING.name, false);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("glows purple by default", () => {
        const world = createHunter();
        const button = (_G as unknown as Record<string, FakeFrame>).ActionButton1;
        const glow = world.frames.find(
            (frame) => frame.parent === button && frame.template === "ActionButtonSpellAlertTemplate" && frame.isShown,
        )!;
        expect(glow.ProcLoopFlipbook!.vertexColor!.slice(0, 3)).toEqual([0.65, 0.3, 1]);
    });

    it("has Shadow Word: Pain for a priest, gone at a cast", () => {
        const pain: SpellDefinition = { id: 589, name: "Shadow Word: Pain", rank: 1, icon: 136207, isHarmful: true, maxRange: 30 };
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, pain);
                state.bars[1] = pain.id;
                state.isInCombat = true;
                hideDebuffs(state);
                state.auraSecrecy.hiddenSpells[pain.id] = true;
                targetEnemy(state);
            },
            { shouldUseDebuffs: true },
        );
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        cast(world, pain);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("glows only where the spell can be cast: in its range, and usable", () => {
        const world = createHunter({ addedSpells: [] });
        world.state.target!.yards = 60;
        world.advance(2);
        // Serpent Sting (35 yards) is out of range, Hunter's Mark (100) is not
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
        world.state.target!.yards = 10;
        world.state.unusableSpells[HUNTERS_MARK.id] = true;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("shows with an enemy targeted by default, in a fight or not", () => {
        const world = createHunter({ addedSpells: [] }, false);
        world.state.isInCombat = false;
        world.fire("PLAYER_REGEN_ENABLED");
        world.advance(6);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("has Corruption and Curse of Agony for a warlock", () => {
        const corruption: SpellDefinition = { id: 172, name: "Corruption", rank: 1, icon: 136118, isHarmful: true, maxRange: 30 };
        const agony: SpellDefinition = { id: 980, name: "Curse of Agony", rank: 1, icon: 136139, isHarmful: true, maxRange: 30 };
        const world = createWorld(
            (state) => {
                playAs(state, { name: "Warlock", token: "WARLOCK", id: 9 });
                learnSpell(state, corruption);
                learnSpell(state, agony);
                state.bars[1] = corruption.id;
                state.bars[2] = agony.id;
                targetEnemy(state);
            },
            { shouldUseDebuffs: true },
        );
        world.advance(6);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("has the Show unlearned spells switch, though every debuff of the class is learned", () => {
        const world = createHunter();
        toggleTable();
        showTab(world, "Debuffs");
        const isShown = (frame: FakeFrame | undefined): boolean => frame === undefined || (frame.isShown && isShown(frame.parent));
        expect(
            world.frames.some((frame) => isShown(frame) && frame.fontStrings.some((text) => text.text === "Show unlearned spells")),
        ).toBe(true);
    });

    it("leaves a priest's Shadow Word: Pain its row on the Procs tab with a proc rule, each row with its own switch", () => {
        const pain: SpellDefinition = { id: 589, name: "Shadow Word: Pain", rank: 1, icon: 136207, isHarmful: true, maxRange: 30 };
        const rule = { spellId: pain.id, kind: "inRange", result: "glow", priority: 1 };
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, pain);
            },
            { shouldUseDebuffs: true, shouldUseProcRules: true, procRules: [rule] },
        );
        world.advance(1);
        toggleTable();
        showTab(world, "Procs");
        expect(countRows(world, pain.name)).toBe(1);
        showTab(world, "Debuffs");
        expect(countRows(world, pain.name)).toBe(1);
        switchInTable(world, pain.name, false);
        expect(world.getSavedSettings()?.enabledSpells).toEqual({ "debuff:589": false });
    });
});
