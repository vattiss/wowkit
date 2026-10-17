import { beforeEach, describe, expect, it, learnSpell, playAs, createWorld, type World } from "@forever/test-kit";
import { FORTITUDE, PRIEST } from "./fixtures";

function pressButton(world: World, label: string): void {
    const button = world.findFrame((frame) => frame.template === "UIPanelButtonTemplate" && frame.text === label);
    expect(button).toBeDefined();
    button?.scripts.OnClick?.(button);
}

/** The text in the report's box; undefined while the box is empty. */
function readReport(world: World): string | undefined {
    return world.findFrame((frame) => frame.frameType === "EditBox" && (frame.text ?? "").includes("debug report"))?.text;
}

describe("the debug report", () => {
    let world!: World;

    // Debug mode on for a few seconds, then the page opened and the report asked for
    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
        });
        world.setOption("isDebugMode", true);
        world.advance(3);
        // The page is built when it is first shown
        const page = world.findFrame(
            (frame) => frame.scripts.OnShow !== undefined && !frame.isShown && frame.template === undefined && frame.parent === undefined,
        );
        expect(page).toBeDefined();
        page?.scripts.OnShow?.(page);
        pressButton(world, "Debug report");
    });

    it("is written into the page", () => {
        expect(readReport(world)).toBeDefined();
    });

    it("counts the samples", () => {
        expect(readReport(world)).toContain("samples: ");
        expect(readReport(world)).not.toContain("samples: 0");
    });

    it("says why a buff is wanted", () => {
        expect(readReport(world)).toContain("buff says | Power Word: Fortitude");
    });

    it("shows no errors the addon swallowed", () => {
        expect(readReport(world)).not.toContain("swallowed error");
    });

    it("is empty after the data is cleared", () => {
        world.setOption("isDebugMode", false);
        pressButton(world, "Clear debug data");
        pressButton(world, "Debug report");
        expect(readReport(world)).toContain("samples: 0");
    });
});
