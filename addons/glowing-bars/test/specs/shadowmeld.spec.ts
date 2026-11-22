// The night elf's Shadowmeld, a utility cooldown of the list: it glows once when ready, anywhere. A player who added it
// before gets the list's row in place of theirs (no X), with the look they set: as a utility cooldown as it is, as a ready
// cooldown moved to a utility cooldown, once, so it does not glow twice.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    WARRIOR,
    type FakeFrame,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { recoverCooldown } from "./cooldown.helpers";
import { showTab, toggleTable } from "./table.helpers";

const SHADOWMELD: SpellDefinition = { id: 20580, name: "Shadowmeld", rank: 1, icon: 132089, cooldownSeconds: 10 };

/** A night elf with Shadowmeld learned (unless not) and on button 1, ready again after a use. */
function createNightElf(saved?: Record<string, unknown>, isLearned = true): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        state.race = { id: 4, file: "NightElf" };
        state.spells[SHADOWMELD.id] = SHADOWMELD;
        if (isLearned) learnSpell(state, SHADOWMELD);
        state.bars[1] = SHADOWMELD.id;
    }, saved);
    world.advance(1);
    recoverCooldown(world, SHADOWMELD.id);
    return world;
}

/** Shadowmeld's rows on the Cooldowns tab of the table, and whether each shows an X (only a row the player added has one). */
function listRows(world: World): { hasX: boolean }[] {
    toggleTable();
    showTab(world, "Cooldowns");
    const isRow = (frame: FakeFrame) => world.frames.some((other) => other.parent === frame && other.frameType === "CheckButton");
    const rows = world.frames.filter(
        (frame) => frame.isShown && isRow(frame) && frame.fontStrings.some((text) => text.text === "Shadowmeld"),
    );
    const hasX = (row: FakeFrame) => world.frames.some((other) => other.parent === row && other.text === "X" && other.isShown);
    const found = rows.map((row) => ({ hasX: hasX(row) }));
    toggleTable();
    return found;
}

describe("the night elf's Shadowmeld", () => {
    it("glows once when ready, as a utility cooldown", () => {
        const world = createNightElf();
        expect(world.glowsOn(1)).toBe(1);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes by the Utility cooldown type's When", () => {
        expect(createNightElf({ styles: { utilityCooldown: { when: "inCombat" } } }).glowsOn(1)).toBe(0);
    });

    it("does not glow for one who has not learned it", () => {
        expect(createNightElf(undefined, false).glowsOn(1)).toBe(0);
    });

    it("added before as a utility cooldown: one row, the list's, with no X, and the look set for it kept", () => {
        const added = { addedSpells: [{ id: SHADOWMELD.id, reminderType: "utilityCooldown" }] };
        const world = createNightElf(added);
        expect(world.glowsOn(1)).toBe(1);
        const rows = listRows(world);
        expect(rows.length).toBe(1);
        expect(rows[0]!.hasX).toBe(false);
        const withLook = createNightElf({ ...added, spellStyles: { "utilityCooldown:Shadowmeld": { when: "inCombat" } } });
        expect(withLook.glowsOn(1)).toBe(0);
    });

    it("added before as a ready cooldown: moved to a utility cooldown with its look, one row with no X", () => {
        // A player of an earlier version: the first move of the utility cooldowns ran already, before Shadowmeld was one
        const world = createNightElf({
            areUtilityLooksMoved: true,
            addedSpells: [{ id: SHADOWMELD.id, reminderType: "readyCooldown" }],
            spellStyles: { "readyCooldown:Shadowmeld": { when: "inCombat" } },
        });
        const saved = world.getSavedSettings()!;
        expect((saved.addedSpells as { reminderType: string }[]).map((spell) => spell.reminderType).join(",")).toBe("utilityCooldown");
        const looks = saved.spellStyles as Record<string, { when?: string } | undefined>;
        expect(looks["utilityCooldown:Shadowmeld"]?.when).toBe("inCombat");
        expect(looks["readyCooldown:Shadowmeld"]).toBe(undefined);
        expect(world.glowsOn(1)).toBe(0);
        const rows = listRows(world);
        expect(rows.length).toBe(1);
        expect(rows[0]!.hasX).toBe(false);
    });

    it("is moved once: added as a ready cooldown after that, it keeps that row, with its X", () => {
        const world = createNightElf({
            areUtilityLooksMoved: true,
            movedUtilityCooldowns: { [tostring(SHADOWMELD.id)]: true },
            addedSpells: [{ id: SHADOWMELD.id, reminderType: "readyCooldown" }],
        });
        expect((world.getSavedSettings()!.addedSpells as { reminderType: string }[])[0]!.reminderType).toBe("readyCooldown");
        const rows = listRows(world);
        expect(rows.length).toBe(2);
        expect(rows.filter((row) => row.hasX).length).toBe(1);
    });
});

describe("Shadowmeld moved to a utility cooldown", () => {
    it("stays switched off when it was switched off as a ready cooldown", () => {
        const world = createNightElf({
            areUtilityLooksMoved: true,
            addedSpells: [{ id: SHADOWMELD.id, reminderType: "readyCooldown" }],
            enabledSpells: { [tostring(SHADOWMELD.id)]: false },
        });
        expect(world.glowsOn(1)).toBe(0);
    });

    it("is moved later when the client does not name it yet: a look is kept by its name", () => {
        const world = createWorld((state) => playAs(state, WARRIOR), { areUtilityLooksMoved: true });
        world.advance(1);
        const moved = world.getSavedSettings()?.movedUtilityCooldowns as Record<string, boolean | undefined> | undefined;
        expect(moved?.[tostring(SHADOWMELD.id)]).toBe(undefined);
    });
});
