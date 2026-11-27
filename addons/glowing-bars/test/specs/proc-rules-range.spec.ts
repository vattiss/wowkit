// The proc rule "In range" (beta): a spell lit while the game says the target is in its range, as Feral Charge out of its
// dead zone (8 to 25 yards). No target, or no answer from the game, is out of range, so it never glows by a guess.
import { createWorld, describe, DRUID, expect, it, learnSpell, playAs, targetEnemy, type FakeFrame, type World } from "@wowkit/test-kit";
import { showTab, toggleTable } from "./table.helpers";

const FERAL_CHARGE = { id: 16979, name: "Feral Charge", rank: 1, icon: 132183, minRange: 8, maxRange: 25, isHarmful: true };
/** A spell the game cannot range: it gives no answer for it. */
const ENRAGE = { id: 5229, name: "Enrage", rank: 1, icon: 132126 };
const IN_RANGE = { spellId: FERAL_CHARGE.id, kind: "inRange", result: "glow", priority: 1 };

/** A druid with Feral Charge on button 1 and Enrage on 2, with these saved settings, the rules on. */
function createDruid(saved: Record<string, unknown>): World {
    const world = createWorld(
        (state) => {
            playAs(state, DRUID);
            learnSpell(state, FERAL_CHARGE);
            learnSpell(state, ENRAGE);
            state.bars[1] = FERAL_CHARGE.id;
            state.bars[2] = ENRAGE.id;
        },
        { shouldUseProcRules: true, ...saved },
    );
    world.advance(1);
    return world;
}

/** The target moved to these yards (none: no target), and a moment later. */
function moveTarget(world: World, yards: number | undefined): void {
    if (yards === undefined) world.state.target = undefined;
    else targetEnemy(world.state, { yards });
    world.advance(1);
}

describe("the proc rule In range", () => {
    it("lights Feral Charge out of its dead zone only, as the target moves", () => {
        const world = createDruid({ procRules: [IN_RANGE] });
        expect(world.glowsOn(1)).toBe(0);
        moveTarget(world, 15);
        expect(world.glowsOn(1)).toBe(1);
        moveTarget(world, 5);
        expect(world.glowsOn(1)).toBe(0);
        moveTarget(world, 30);
        expect(world.glowsOn(1)).toBe(0);
        moveTarget(world, 25);
        expect(world.glowsOn(1)).toBe(1);
        moveTarget(world, undefined);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("counts no answer from the game as out of range", () => {
        const world = createDruid({ procRules: [{ ...IN_RANGE, spellId: ENRAGE.id }] });
        moveTarget(world, 10);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("keeps the spell dark in range by a No glow rule of a lower number", () => {
        const usable = { ...IN_RANGE, kind: "usable", priority: 2 };
        const world = createDruid({ procRules: [{ ...IN_RANGE, result: "noGlow" }, usable] });
        moveTarget(world, 5);
        expect(world.glowsOn(1)).toBe(1);
        moveTarget(world, 15);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("the In range rule on the Proc rules tab", () => {
    function findFrameOf(world: World, words: string): FakeFrame | undefined {
        const isShown = (frame: FakeFrame | undefined): boolean => frame === undefined || (frame.isShown && isShown(frame.parent));
        return world.frames.find((frame) => isShown(frame) && frame.fontStrings.some((text) => text.text === words));
    }

    function listParts(world: World, frame: FakeFrame, frameType: string): FakeFrame[] {
        return world.frames.filter((other) => other.parent === frame && other.frameType === frameType);
    }

    it("is added from the list of conditions, and its row says what counts as in range", () => {
        const world = createDruid({});
        toggleTable();
        showTab(world, "Proc rules");
        const addRow = findFrameOf(world, "Add a rule")!;
        const [spell] = listParts(world, addRow, "EditBox");
        const [conditionButton, , addButton] = listParts(world, addRow, "Button");
        world.pickFromMenu(conditionButton!, "In range");
        spell!.text = String(FERAL_CHARGE.id);
        addButton!.scripts.OnClick!(addButton!);
        expect((world.getSavedSettings()!.procRules as { kind: string }[])[0]!.kind).toBe("inRange");
        const row = findFrameOf(world, "In range")!;
        row.scripts.OnEnter!(row);
        expect(world.findFrame((frame) => frame.name === "GameTooltip")?.text).toBe(
            "Glows while the game says the target is in the spell's range. No target, or no answer: no glow.",
        );
    });
});
