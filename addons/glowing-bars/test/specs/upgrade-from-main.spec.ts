// A player who comes from the last release: the settings it saved (made by its own code, see upgrade-from-main.saved.ts)
// are loaded by this one. Nothing the player set may be lost or change: the cooldowns of between fights move to their new
// type with their looks, the row of a reagent splits into the rows of its spells with its switch, limit and look, and a
// second login changes nothing more.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, WARRIOR, type World } from "@wowkit/test-kit";
import { RECKLESSNESS, findLabel, findRow, showTab, showUnlearned, toggleTable } from "./table.helpers";
import { MAIN_PRIEST, MAIN_WARRIOR } from "./upgrade-from-main.saved";

type Looks = Record<string, { color?: number[]; glowPercent?: number } | undefined>;

/** A copy all the way down: the saved tables of a world are its own. */
function copySaved<T>(value: T): T {
    if (type(value) !== "table") return value;
    const copy: Record<string, unknown> = {};
    for (const [key, item] of pairs(value as object)) copy[key as string] = copySaved(item);
    return copy as T;
}

function loginWarrior(saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        learnSpell(state, RECKLESSNESS);
        learnSpell(state, { id: 20552, name: "Cultivation", rank: 1, icon: 136099, cooldownSeconds: 900 });
        learnSpell(state, { id: 556, name: "Astral Recall", rank: 1, icon: 136010, cooldownSeconds: 900 });
        state.bars[1] = 20552;
        state.bars[2] = RECKLESSNESS.id;
        state.bars[3] = 556;
    }, copySaved(saved));
    world.advance(1);
    return world;
}

const PRAYERS: [id: number, name: string][] = [
    [21564, "Prayer of Fortitude"],
    [27681, "Prayer of Spirit"],
    [27683, "Prayer of Shadow Protection"],
];

function loginPriest(saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        for (const [id, name] of PRAYERS) {
            learnSpell(state, { id, name, rank: 1, icon: 135941, isHelpful: true });
            state.reagentTexts[id] = "Sacred Candle";
        }
        state.bars[1] = 21564;
        state.bags[17029] = 30;
    }, copySaved(saved));
    world.advance(1);
    return world;
}

/** The settings as text, in a fixed order, to tell whether anything changed. */
function describeSaved(value: unknown): string {
    if (type(value) !== "table") return tostring(value);
    const entries: [key: string, item: unknown][] = [];
    for (const [key, item] of pairs(value as object)) entries.push([tostring(key), item]);
    entries.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    return `{${entries.map(([key, item]) => `${key}=${describeSaved(item)}`).join(",")}}`;
}

describe("a warrior who comes from the last release", () => {
    it("keeps the looks of Cultivation and of the added Astral Recall, now utility cooldowns, and Recklessness's", () => {
        const saved = loginWarrior(MAIN_WARRIOR).getSavedSettings()!;
        const looks = saved.spellStyles as Looks;
        expect(looks["utilityCooldown:Cultivation"]?.glowPercent).toBe(40);
        expect(looks["utilityCooldown:Cultivation"]?.color?.join(",")).toBe("1,0,0");
        expect(looks["utilityCooldown:Astral Recall"]?.color?.join(",")).toBe("0,0,1");
        expect(looks["readyCooldown:Recklessness"]?.color?.join(",")).toBe("0,1,0");
        expect(looks["readyCooldown:Cultivation"]).toBe(undefined);
        expect((saved.styles as Looks).readyCooldown?.glowPercent).toBe(70);
        expect(describeSaved(saved.addedSpells)).toBe("{1={id=556,reminderType=utilityCooldown}}");
        expect((saved.enabledSpells as Record<string, boolean>)["556"]).toBe(false);
    });

    it("shows them in the table as the player left them: changed, and Astral Recall off", () => {
        const world = loginWarrior(MAIN_WARRIOR);
        toggleTable();
        showTab(world, "Cooldowns");
        showUnlearned(world, "Cooldowns");
        const cultivation = findLabel(world, "Cultivation")!;
        expect(cultivation.parent!.fontStrings.some((text) => text.text === "Utility cooldown")).toBe(true);
        expect(findRow(world, "Astral Recall").enabled.isChecked).toBe(false);
        expect(findRow(world, "Recklessness").enabled.isChecked).toBe(true);
    });

    it("changes nothing more at the next login", () => {
        const first = copySaved(loginWarrior(MAIN_WARRIOR).getSavedSettings()!);
        const second = loginWarrior(first).getSavedSettings()!;
        expect(describeSaved(second)).toBe(describeSaved(first));
    });
});

describe("a priest who comes from the last release", () => {
    it("gives each spell of the Sacred Candle the row's switch, limit and look", () => {
        const saved = loginPriest(MAIN_PRIEST).getSavedSettings()!;
        const enabled = saved.enabledSpells as Record<string, boolean | undefined>;
        const limits = saved.belowLimits as Record<string, number | undefined>;
        const looks = saved.spellStyles as Looks;
        for (const [id, name] of PRAYERS) {
            expect(enabled[`${id}`]).toBe(false);
            expect(limits[`lowReagent:spell${id}`]).toBe(5);
            expect(looks[`lowReagent:${name}`]?.color?.join(",")).toBe("1,0,0");
        }
        expect((saved.styles as Looks).missingBuff?.glowPercent).toBe(60);
    });

    it("shows each of its rows switched off, with the limit 5", () => {
        const world = loginPriest(MAIN_PRIEST);
        toggleTable();
        showTab(world, "Consumables");
        for (const [, name] of PRAYERS) {
            const label = `Sacred Candle (${name})`;
            expect(findRow(world, label).enabled.isChecked).toBe(false);
            const row = findLabel(world, label)!.parent;
            const boxes = world.frames.filter((frame) => frame.parent === row && frame.frameType === "EditBox");
            expect(boxes.some((box) => box.text === "5")).toBe(true);
        }
    });

    it("changes nothing more at the next login", () => {
        const first = copySaved(loginPriest(MAIN_PRIEST).getSavedSettings()!);
        const second = loginPriest(first).getSavedSettings()!;
        expect(describeSaved(second)).toBe(describeSaved(first));
    });
});
