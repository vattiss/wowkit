import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    WARRIOR,
    type ClientState,
    type FakeColorPicker,
    type FakeFrame,
    type SpellDefinition,
    type World,
    PRIEST,
    SMITE_RANK_1,
    SMITE_RANK_2,
} from "@wowkit/test-kit";

const RECKLESSNESS: SpellDefinition = { id: 1719, name: "Recklessness", rank: 1, icon: 132109, cooldownSeconds: 300, isHelpful: true };

/** Recklessness is used in the fight and comes back: the moment it glows in combat. */
function useAndRecoverRecklessness(world: World): void {
    world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
    world.advance(0.5);
    world.state.cooldowns[RECKLESSNESS.id] = undefined;
    world.advance(0.5);
}

function setUpWarrior(state: ClientState): void {
    playAs(state, WARRIOR);
    learnSpell(state, RECKLESSNESS);
    state.bars[2] = RECKLESSNESS.id;
    state.isInCombat = true;
}

/** The widgets of the row with this label in the open table. */
interface Row {
    swatch: FakeFrame;
    opacity: FakeFrame;
    message: FakeFrame;
    sound: FakeFrame;
    reset: FakeFrame;
}

/** The text with this label: the text widgets are not frames of their own, they belong to the frame that made them. */
function findLabel(world: World, label: string): FakeFrame | undefined {
    for (const frame of world.frames) {
        const found = frame.fontStrings.find((text) => text.text === label);
        if (found !== undefined) return found;
    }
    return undefined;
}

function findRow(world: World, label: string): Row {
    const row = findLabel(world, label)?.parent;
    if (row === undefined) throw new Error(`no row for ${label}`);
    const parts = world.frames.filter((frame) => frame.parent === row);
    const buttons = parts.filter((frame) => frame.frameType === "Button" && frame.template === "UIPanelButtonTemplate");
    return {
        swatch: parts.find((frame) => frame.frameType === "Button" && frame.template === undefined)!,
        opacity: parts.find((frame) => frame.frameType === "EditBox")!,
        message: parts.find((frame) => frame.frameType === "CheckButton")!,
        sound: buttons[0]!,
        reset: buttons[1]!,
    };
}

function toggleTable(): void {
    SlashCmdList["GLOWINGBARSANDAURAS"]!("", undefined as never);
}

function readSaved(world: World, section: "styles" | "spellStyles"): Record<string, Record<string, unknown> | undefined> {
    return world.getSavedSettings()?.[section] as Record<string, Record<string, unknown> | undefined>;
}

describe("the table of looks", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpWarrior);
        world.advance(1);
        useAndRecoverRecklessness(world);
        toggleTable();
    });

    it("opens with /gba, a row for each kind and for each spell of the class", () => {
        const window = world.findFrame((frame) => frame.name === "GlowingBarsAndAurasLooks");
        expect(window?.isShown).toBe(true);
        for (const label of ["Missing buff", "Ready cooldown", "Proc", "Recklessness"]) {
            expect(findLabel(world, label)).toBeDefined();
        }
    });

    it("closes with /gba again", () => {
        toggleTable();
        expect(world.findFrame((frame) => frame.name === "GlowingBarsAndAurasLooks")?.isShown).toBe(false);
    });

    it("changes the opacity of a spell when a percent is typed, and the glow follows", () => {
        const row = findRow(world, "Recklessness");
        row.opacity.text = "40";
        row.opacity.scripts.OnEnterPressed!(row.opacity);
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]?.opacity).toBe(40);
        expect(world.glowAlphasOn(2)).toEqual([0.4]);
    });

    it("changes the opacity of a kind for all of its spells", () => {
        const row = findRow(world, "Ready cooldown");
        row.opacity.text = "60";
        row.opacity.scripts.OnEnterPressed!(row.opacity);
        expect(readSaved(world, "styles").cooldown?.opacity).toBe(60);
        expect(world.glowAlphasOn(2)).toEqual([0.6]);
    });

    it("switches the message of a spell on", () => {
        const row = findRow(world, "Recklessness");
        row.message.isChecked = true;
        row.message.scripts.OnClick!(row.message);
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]?.isTextOn).toBe(true);
        expect(world.notice()).toContain("Cooldown ready");
    });

    it("takes the next sound on a click and plays it", () => {
        const row = findRow(world, "Recklessness");
        row.sound.scripts.OnClick!(row.sound, "LeftButton");
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]?.sound).toBe("raidwarning");
        expect(world.sounds).toEqual([8959]);
    });

    it("takes the color the game's picker gives", () => {
        const row = findRow(world, "Recklessness");
        row.swatch.scripts.OnClick!(row.swatch);
        const picker = ColorPickerFrame as unknown as FakeColorPicker;
        picker.pickedColor = [1, 0, 0];
        picker.info!.swatchFunc();
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]?.color).toEqual([1, 0, 0]);
    });

    it("keeps the saved percent when Escape is pressed in the box", () => {
        const row = findRow(world, "Recklessness");
        row.opacity.text = "40";
        row.opacity.scripts.OnEscapePressed!(row.opacity);
        // Letting go of the box saves what it shows
        row.opacity.scripts.OnEditFocusLost!(row.opacity);
        expect(row.opacity.text).toBe("100");
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]).toBeUndefined();
    });

    it("keeps no change that is the same as what the spell inherits", () => {
        const row = findRow(world, "Recklessness");
        row.opacity.text = "100";
        row.opacity.scripts.OnEnterPressed!(row.opacity);
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]).toBeUndefined();
    });

    it("forgets what the player changed for a spell on Reset", () => {
        const row = findRow(world, "Recklessness");
        row.opacity.text = "40";
        row.opacity.scripts.OnEnterPressed!(row.opacity);
        row.reset.scripts.OnClick!(row.reset);
        expect(readSaved(world, "spellStyles")["cooldown:Recklessness"]).toBeUndefined();
        expect(world.glowAlphasOn(2)).toEqual([1]);
    });
});

describe("the ranked spells of the table", () => {
    const MIND_BLAST: SpellDefinition = { id: 8092, name: "Mind Blast", rank: 1, icon: 136224, castTimeMs: 1500, isHarmful: true };

    it("are all the spells of the book that have ranks, on a bar or not", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            for (const spell of [SMITE_RANK_1, SMITE_RANK_2, MIND_BLAST]) learnSpell(state, spell);
            state.bars[1] = SMITE_RANK_1.id;
        });
        world.advance(1);
        toggleTable();
        expect(findLabel(world, "Smite")).toBeDefined();
        expect(findLabel(world, "Mind Blast")).toBeDefined();
    });
});
