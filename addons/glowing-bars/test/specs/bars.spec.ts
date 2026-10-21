import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    FORTITUDE,
    GAMEPAD_BAR,
    PALADIN,
    PRIEST,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

/** Action Bar 7 starts at this action slot. */
const BAR_7_FIRST_SLOT = 157;

describe("a priest with Fortitude on Action Bar 1 and on Action Bar 7", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[1] = FORTITUDE.id;
            state.bars[BAR_7_FIRST_SLOT] = FORTITUDE.id;
        });
        world.advance(1);
    });

    it("sees the missing buff glow on both bars", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(1, "MultiBar6")).toBe(1);
    });

    it("sees it only on Action Bar 7 once Action Bar 1 is switched off", () => {
        world.setOption("bar_1", false);
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(1, "MultiBar6")).toBe(1);
    });

    it("keeps the switch only where the player changed it", () => {
        world.setOption("bar_1", false);
        world.setOption("bar_1", true);
        const barOff = world.getSavedSettings()?.barOff as Record<string, boolean | undefined>;
        expect(barOff["1"]).toBeUndefined();
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("a priest who plays with a gamepad, in Forever's gamepad mode", () => {
    /** The right bar of the gamepad mode starts at this action slot. */
    const RIGHT_BAR_FIRST_SLOT = 193;

    it("sees the missing buff glow on the button of the gamepad bar", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, FORTITUDE);
            state.bars[RIGHT_BAR_FIRST_SLOT] = FORTITUDE.id;
        });
        world.advance(1);
        const name = `${GAMEPAD_BAR}PageUnitRightCenteredAnchorRightBarActionButton1`;
        expect(world.glowsOnFrame(name)).toBe(1);
        // Not a child of the button: a frame an addon made there would taint the gamepad bars' code
        const button = world.findFrame((frame) => frame.name === name)!;
        expect(world.frames.some((frame) => frame.parent === button)).toBe(false);
        // It hides with the button, and is back with it
        button.Hide();
        expect(world.glowsOnFrame(name)).toBe(0);
        button.Show();
        expect(world.glowsOnFrame(name)).toBe(1);
    });
});

describe("a paladin with no aura, in Forever's gamepad mode", () => {
    const DEVOTION_AURA: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };

    it("sees the aura glow on the class button, which shows the aura picked from its flyout", () => {
        const world = createWorld((state) => {
            playAs(state, PALADIN);
            learnSpell(state, DEVOTION_AURA);
            state.gamepadClassSpell = DEVOTION_AURA.id;
        });
        world.advance(1);
        expect(world.glowsOnFrame(`${GAMEPAD_BAR}PageUnitLeftClassAction`)).toBe(1);
        // A round button: the client's round highlight, not the square spell alert
        const classButton = world.findFrame((frame) => frame.name === `${GAMEPAD_BAR}PageUnitLeftClassAction`);
        expect(world.frames.some((frame) => frame.parent === classButton && frame.template === "ActionButtonSpellAlertTemplate")).toBe(
            false,
        );
    });
});

describe("a priest who chose how the glow moves", () => {
    function findAlert(world: World) {
        const button = world.findFrame((frame) => frame.name === "ActionButton1");
        return world.frames.find((frame) => frame.parent === button && frame.template === "ActionButtonSpellAlertTemplate")!;
    }

    function setUp(state: Parameters<Parameters<typeof createWorld>[0]>[0]): void {
        playAs(state, PRIEST);
        learnSpell(state, FORTITUDE);
        state.bars[1] = FORTITUDE.id;
    }

    it("sees the missing buff glow standing still: Blizzard's glow, without the flash it starts with", () => {
        const world = createWorld(setUp, { glowStyle: "still" });
        world.advance(1);
        const alert = findAlert(world);
        expect(alert.isShown).toBe(true);
        expect(alert.ProcStartFlipbook!.isShown).toBe(false);
        expect(alert.ProcLoopFlipbook!.isShown).toBe(true);
    });

    it("sees the glow breathing as Blizzard's glow standing still, without the flash", () => {
        const world = createWorld(setUp, { glowStyle: "breathing" });
        world.advance(1);
        const alert = findAlert(world);
        expect(alert.ProcStartFlipbook!.isShown).toBe(false);
        expect(alert.ProcLoopFlipbook!.isShown).toBe(true);
    });

    it("sees the animation, with its flash, by default", () => {
        const world = createWorld(setUp);
        world.advance(1);
        expect(findAlert(world).ProcStartFlipbook!.isShown).toBe(true);
    });

    it("has a switch for it on the Settings page", () => {
        const world = createWorld(setUp);
        world.setOption("glowStyle", "still");
        world.advance(1);
        expect(findAlert(world).ProcStartFlipbook!.isShown).toBe(false);
    });
});
