// ConsolePort (issue #94): its buttons of Forever's gamepad slots are made as the gamepad's bindings come in, after the
// login, and its crossbar's by LibActionButton-1.0, named by the bindings. Both glow with no scan, after a reload too. A bar
// addon's buttons of no known name made after the login are searched for again as the key bindings change.
import { createWorld, describe, expect, it, learnSpell, playAs, PRIEST, FORTITUDE, reloadWorld, type World } from "@wowkit/test-kit";

/** Forever's first gamepad slot: ConsolePort's gamepad bar 1, slot 1. */
const GAMEPAD_SLOT = 185;

interface FakeButton {
    action: number;
    GetAttribute?: (this: unknown, key: string) => unknown;
}

function setUp(state: Parameters<Parameters<typeof createWorld>[0]>[0]): void {
    playAs(state, PRIEST);
    learnSpell(state, FORTITUDE);
    state.bars[GAMEPAD_SLOT] = FORTITUDE.id;
}

/** A priest missing Fortitude, which is on the first gamepad slot only, with these settings; logged in. */
function login(saved?: Record<string, unknown>): World {
    const world = createWorld(setUp, saved);
    world.advance(5);
    return world;
}

/** A button on the gamepad slot, made now, as ConsolePort makes it (the slot in its "action"; LibActionButton's in `action`). */
function makeButton(name: string): FakeButton {
    const button = CreateFrame("Button", name) as unknown as FakeButton;
    button.action = GAMEPAD_SLOT;
    return button;
}

/** LibActionButton-1.0, as an addon loaded it, with these buttons in its own table. */
function loadLibrary(buttons: FakeButton[]): void {
    const all = new LuaTable<FakeButton, boolean>();
    for (const button of buttons) all.set(button, true);
    const library = { buttonRegistry: all, GetAllButtons: (_library: unknown) => all };
    (_G as unknown as Record<string, unknown>).LibStub = function (this: void, name: string) {
        return name === "LibActionButton-1.0" ? library : undefined;
    };
}

/** What `read` gives, with the library loaded meanwhile; LibStub is gone again after, whatever happens. */
function readWithLibrary<T>(buttons: FakeButton[], read: () => T): T | undefined {
    loadLibrary(buttons);
    const [didSucceed, result] = pcall(read);
    (_G as unknown as Record<string, unknown>).LibStub = undefined;
    if (!didSucceed) error(result);
    return result;
}

/** The least time between two searches the key bindings ask for, and a little more. */
const SEARCH_GAP = 30;

describe("a priest who plays with ConsolePort", () => {
    it("sees the glow on its gamepad slot button, made after the login, with no scan", () => {
        const world = login();
        makeButton("ConsolePortGamepadBar1Slot1");
        world.advance(5);
        expect(world.glowsOnFrame("ConsolePortGamepadBar1Slot1")).toBe(1);
    });

    it("sees it again after a reload, with no scan", () => {
        const world = reloadWorld(login());
        world.advance(5);
        makeButton("ConsolePortGamepadBar1Slot1");
        world.advance(5);
        expect(world.glowsOnFrame("ConsolePortGamepadBar1Slot1")).toBe(1);
    });

    it("sees the glow on its crossbar's button, which LibActionButton made after the login", () => {
        const world = login();
        const glows = readWithLibrary([makeButton("CPB_PADDUP_")], () => {
            world.advance(5);
            return world.glowsOnFrame("CPB_PADDUP_");
        });
        expect(glows).toBe(1);
    });
});

describe("a bar addon's button of no known name, made after the login", () => {
    /** Shown and saying it is an action button, as the search wants. */
    function makeUnknownButton(name: string): void {
        const button = makeButton(name) as FakeButton & Record<string, unknown>;
        button.GetAttribute = function (this: unknown, key: string) {
            return key === "type" ? "action" : undefined;
        };
        button.IsForbidden = function (this: unknown) {
            return false;
        };
        button.IsObjectType = function (this: unknown, kind: string) {
            return kind === "Button";
        };
    }

    it("is found as the key bindings change, with no scan", () => {
        const world = login();
        makeUnknownButton("SomeBarButton1");
        world.advance(5);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(0);
        world.fire("UPDATE_BINDINGS");
        world.advance(SEARCH_GAP + 5);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(1);
    });

    it("is searched for at most once in a while, however often the key bindings change", () => {
        const world = login();
        makeUnknownButton("SomeBarButton1");
        world.fire("UPDATE_BINDINGS");
        world.advance(SEARCH_GAP + 5);
        makeUnknownButton("SomeBarButton2");
        world.fire("UPDATE_BINDINGS");
        world.advance(5);
        expect(world.glowsOnFrame("SomeBarButton2")).toBe(0);
        // The change is not lost: the search runs once the gap is over
        world.advance(SEARCH_GAP);
        expect(world.glowsOnFrame("SomeBarButton2")).toBe(1);
    });

    it("is not searched for again right after a search that ended meanwhile (a scan)", () => {
        const world = login();
        world.advance(SEARCH_GAP + 5);
        world.fire("UPDATE_BINDINGS");
        // The Welcome tab's Scan button
        const scan = world.frames.find((frame) => frame.frameType === "Button" && frame.text === "Scan")!;
        scan.scripts.OnClick!(scan);
        world.advance(0.5);
        makeUnknownButton("SomeBarButton1");
        world.advance(5);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(0);
        world.advance(SEARCH_GAP);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(1);
    });

    it("is searched for once a fight is over, not in it", () => {
        const world = login();
        makeUnknownButton("SomeBarButton1");
        world.state.isInCombat = true;
        world.fire("UPDATE_BINDINGS");
        world.advance(SEARCH_GAP + 5);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(0);
        world.state.isInCombat = false;
        world.fire("PLAYER_REGEN_ENABLED");
        world.advance(5);
        expect(world.glowsOnFrame("SomeBarButton1")).toBe(1);
    });
});

describe("the round glow on ConsolePort's crossbar buttons", () => {
    /** Is Blizzard's square spell alert lit on the button (the missing buff circles: a round button breathes instead)? */
    function hasSquareAlert(world: World, name: string): boolean {
        const button = world.findFrame((frame) => frame.name === name);
        return world.frames.some(
            (frame) => frame.parent === button && frame.template === "ActionButtonSpellAlertTemplate" && frame.isShown,
        );
    }

    /** Whether the crossbar's button, and another addon's of the library, have the square alert, with the setting so. */
    function readSquareAlerts(isRound: boolean): [crossbar: boolean, other: boolean] | undefined {
        const world = login({ areConsolePortButtonsRound: isRound });
        return readWithLibrary([makeButton("CPB_PADDUP_"), makeButton("OtherBarButton1")], () => {
            world.advance(5);
            return [hasSquareAlert(world, "CPB_PADDUP_"), hasSquareAlert(world, "OtherBarButton1")];
        });
    }

    it("is there once the player turns it on: another addon's buttons stay square", () => {
        expect(readSquareAlerts(true)).toEqual([false, true]);
    });

    it("is not there by default", () => {
        expect(readSquareAlerts(false)).toEqual([true, true]);
    });

    it("turns on as the box is ticked, with no reload", () => {
        const world = createWorld((state) => {
            setUp(state);
            state.loadedAddons.ConsolePort_Bar = true;
        });
        world.advance(5);
        const alerts = readWithLibrary([makeButton("CPB_PADDUP_")], () => {
            world.advance(5);
            const before = hasSquareAlert(world, "CPB_PADDUP_");
            world.setOption("consolePortRound", true);
            world.advance(2);
            return [before, hasSquareAlert(world, "CPB_PADDUP_")];
        });
        expect(alerts).toEqual([true, false]);
    });

    it("is offered only where ConsolePort's crossbar is loaded", () => {
        const isOffered = (isLoaded: boolean) => {
            const world = createWorld((state) => {
                setUp(state);
                state.loadedAddons.ConsolePort_Bar = isLoaded;
            });
            world.advance(1);
            world.openOptions();
            world.advance(1);
            const general = world.frames.find((frame) => frame.frameType === "Button" && frame.text === "General")!;
            general.scripts.OnClick!(general);
            const row = world.frames.find(
                (frame) => (frame as unknown as { optionLabel?: string }).optionLabel === "Round glow on ConsolePort's buttons (alpha)",
            )!;
            return row.isShown;
        };
        expect(isOffered(true)).toBe(true);
        expect(isOffered(false)).toBe(false);
    });
});
