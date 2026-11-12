import {
    createWorld,
    describe,
    expect,
    fakeFlipbooks,
    FORTITUDE,
    GAMEPAD_BAR,
    it,
    learnSpell,
    playAs,
    PRIEST,
    type FakeFrame,
    type World,
} from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

function findPicture(world: World): FakeFrame {
    return world.frames.find((frame) => frame.template === "ActionButtonSpellAlertTemplate" && frame.isShown)!.ProcLoopFlipbook!;
}

describe("a glow switched to Breathing (ants), to Circling (ants), then back", () => {
    it("stands still again: the picture it stood on before does not hide the sheet", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, FORTITUDE);
                state.bars[1] = FORTITUDE.id;
            },
            { styles: { missingBuff: { animation: "breathing" } } },
        );
        world.advance(1);
        expect(findPicture(world).alpha).toBe(1);
        toggleTable();
        const row = findLabel(world, "Missing buff")!.parent;
        for (const choice of ["Circling (ants)", "Breathing (ants)"]) {
            const button = world.frames.find((frame) => frame.parent === row && frame.frameType === "Button" && frame.width === 124)!;
            world.pickFromMenu(button, choice);
            world.advance(2);
        }
        expect(findPicture(world).alpha).toBe(1);
    });
});

describe("a glow standing still, as the game still loads", () => {
    it("never shows the whole sheet of its pictures: it waits until the animation has one to stand on", () => {
        fakeFlipbooks.isStalled = true;
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, FORTITUDE);
                state.bars[1] = FORTITUDE.id;
            },
            { styles: { missingBuff: { animation: "breathing" } } },
        );
        world.advance(1);
        const picture = findPicture(world);
        expect(picture.alpha).toBe(0);
        fakeFlipbooks.isStalled = false;
        world.advance(1);
        expect(picture.alpha).toBe(1);
    });
});

describe("a priest in Forever's gamepad mode, with each look of the glow", () => {
    /** The first button of the left gamepad bar is square (slot 185), of the right one round (slot 193). */
    const BUTTONS = [
        [185, `${GAMEPAD_BAR}PageUnitLeftCenteredAnchorLeftBarActionButton1`],
        [193, `${GAMEPAD_BAR}PageUnitRightCenteredAnchorRightBarActionButton1`],
    ] as const;
    for (const animation of [
        "circling",
        "clean",
        "circlingClassic",
        "circlingOriginal",
        "breathing",
        "breathingClean",
        "breathingClassic",
        "breathingOriginal",
        "none",
        "noneClean",
        "noneClassic",
        "noneOriginal",
    ] as const) {
        for (const [slot, name] of BUTTONS) {
            it(`sees the missing buff glow by the button of slot ${slot} with ${animation}`, () => {
                const world = createWorld(
                    (state) => {
                        playAs(state, PRIEST);
                        learnSpell(state, FORTITUDE);
                        state.bars[slot] = FORTITUDE.id;
                    },
                    { styles: { missingBuff: { animation } } },
                );
                world.advance(1);
                expect(world.glowsOnFrame(name)).toBe(1);
            });
        }
    }
});

describe("an original look on a round gamepad button", () => {
    it("keeps the art's own colors there too, and a classic look takes the reminder's", () => {
        const readRingTint = (animation: string) => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, FORTITUDE);
                    state.bars[193] = FORTITUDE.id;
                },
                { styles: { missingBuff: { animation, color: [0, 0, 1] } } },
            );
            world.advance(1);
            const button = world.frames.find((frame) => frame.name === `${GAMEPAD_BAR}PageUnitRightCenteredAnchorRightBarActionButton1`)!;
            const ring = world.frames.find((frame) => frame.anchor === button && frame.isShown && frame.frameType === "Frame")!;
            const pulsing = world.frames.find((frame) => frame.parent === ring)!;
            return pulsing.textures
                .map((texture) => `${tostring(texture.isDesaturated)} ${(texture.vertexColor ?? []).slice(0, 3).join(",")}`)
                .join(" | ");
        };
        expect(readRingTint("breathingOriginal")).toBe("false 1,1,1 | false 1,1,1");
        expect(readRingTint("breathingClassic")).toBe("true 0,0,1 | true 0,0,1");
    });
});

describe("the classic look of the glow", () => {
    const ANTS = "Interface\\SpellActivationOverlay\\IconAlertAnts";
    const BORDER = "Interface\\SpellActivationOverlay\\IconAlert";

    /** The files of the textures of the glow shown on button 1. */
    function listGlowFiles(animation: string): string[] {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, FORTITUDE);
                state.bars[1] = FORTITUDE.id;
            },
            { styles: { missingBuff: { animation } } },
        );
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        const button = world.frames.find((frame) => frame.name === "ActionButton1")!;
        const glow = world.frames.find((frame) => frame.parent === button && frame.isShown && frame.frameType === "Frame")!;
        const files: string[] = [];
        for (const inner of world.frames.filter((frame) => frame.parent === glow))
            for (const texture of inner.textures) files.push(texture.file ?? "");
        return files;
    }

    it("circles with the gold border and its marching ants", () => {
        expect(listGlowFiles("circlingClassic")).toEqual([BORDER, ANTS]);
    });

    it("stands still, breathing or not, with the gold border alone", () => {
        expect(listGlowFiles("breathingClassic")).toEqual([BORDER]);
        expect(listGlowFiles("noneClassic")).toEqual([BORDER]);
    });

    it("is tinted with the reminder's color, and the original one keeps the game's own gold", () => {
        const readTint = (animation: string) => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, FORTITUDE);
                    state.bars[1] = FORTITUDE.id;
                },
                { styles: { missingBuff: { animation, color: [0, 0, 1] } } },
            );
            world.advance(1);
            const button = world.frames.find((frame) => frame.name === "ActionButton1")!;
            const glow = world.frames.find((frame) => frame.parent === button && frame.isShown && frame.frameType === "Frame")!;
            const inner = world.frames.find((frame) => frame.parent === glow)!;
            return inner.textures
                .map((texture) => `${tostring(texture.isDesaturated)} ${(texture.vertexColor ?? []).slice(0, 3).join(",")}`)
                .join(" | ");
        };
        expect(readTint("circlingClassic")).toBe("true 0,0,1 | true 0,0,1");
        expect(readTint("circlingOriginal")).toBe("false 1,1,1 | false 1,1,1");
        expect(readTint("breathingClassic")).toBe("true 0,0,1");
        expect(readTint("breathingOriginal")).toBe("false 1,1,1");
        expect(readTint("noneOriginal")).toBe("false 1,1,1");
    });

    it("is offered in the table as the third look of each animation", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
        });
        world.advance(1);
        toggleTable();
        const row = findLabel(world, "Missing buff")!.parent;
        const button = world.frames.find((frame) => frame.parent === row && frame.frameType === "Button" && frame.width === 124)!;
        expect(world.openMenu(button).map((choice) => choice.label)).toEqual([
            "Circling (ants)",
            "Circling (clean)",
            "Circling (classic)",
            "Circling (original)",
            "Breathing (ants)",
            "Breathing (clean)",
            "Breathing (classic)",
            "Breathing (original)",
            "None (ants)",
            "None (clean)",
            "None (classic)",
            "None (original)",
        ]);
    });

    it("is kept by the repair of the saved settings", () => {
        const world = createWorld((state) => playAs(state, PRIEST), { styles: { missingBuff: { animation: "circlingClassic" } } });
        world.advance(1);
        const styles = world.getSavedSettings()?.styles as Record<string, Record<string, unknown> | undefined>;
        expect(styles.missingBuff?.animation).toBe("circlingClassic");
    });
});
