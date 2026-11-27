// The proc rules on a buff's stacks (beta): the addon's rule on Unsealed Wrath at 3 stacks, and the player's own. Out of a
// fight the stacks are read and compared; in one the game hides them, and a gate it drives lets the glow through at the
// stacks only (a mask on the glow's textures). When nothing can tell, nothing glows.
import {
    createSecretNumber,
    createWorld,
    describe,
    expect,
    type FakeFrame,
    isShownThroughMasks,
    it,
    learnSpell,
    PALADIN,
    playAs,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { findRow, showTab, toggleTable } from "./table.helpers";

const UNSEALED_WRATH: SpellDefinition = { id: 1311703, name: "Unsealed Wrath", rank: 0, icon: 135959, isHelpful: true };
const HOLY_STRIKE: SpellDefinition = { id: 407676, name: "Holy Strike", rank: 1, icon: 135891, isHarmful: true };
const RULES_ON = { shouldUseProcRules: true, isCooldownManagerSetUp: true };
const ICONS_SHOWN = { trackedBuffsIcons: "show", trackedBarsIcons: "show" };

/** A paladin with Unsealed Wrath on button 1, its aura up with these stacks out of a fight (none: no aura). */
function createPaladin(stacks: number | undefined, saved: Record<string, unknown> = {}): World {
    const world = createWorld(
        (state) => {
            playAs(state, PALADIN);
            learnSpell(state, UNSEALED_WRATH);
            state.bars[1] = UNSEALED_WRATH.id;
            if (stacks !== undefined)
                state.auras.push({ name: UNSEALED_WRATH.name, spellId: UNSEALED_WRATH.id, expirationTime: 1015, stacks });
        },
        { ...RULES_ON, ...saved },
    );
    world.advance(1);
    return world;
}

/** The fight: the game hands no aura, its icon in Tracked Buffs keeps it, with these stacks (or all of it secret). */
function enterFight(world: World, icon: { applications?: number; isAuraDataSecret?: boolean } | undefined): void {
    world.state.auras.length = 0;
    world.state.isInCombat = true;
    world.state.areAurasHidden = true;
    if (icon !== undefined) world.state.trackedBuffs.push({ spellId: UNSEALED_WRATH.id, isActive: true, ...icon });
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(1);
}

/** The glows lit on a button: the addon's spell-alert frames on it. */
function listGlows(world: World, button = "ActionButton1"): FakeFrame[] {
    const buttonFrame = (_G as unknown as Record<string, FakeFrame>)[button];
    return world.frames.filter(
        (frame) => frame.parent === buttonFrame && frame.template === "ActionButtonSpellAlertTemplate" && frame.isShown,
    );
}

/** Is a glow seen on button 1: lit, and its art showing through the gate's mask? */
function isGlowSeen(world: World): boolean {
    return listGlows(world).some((glow) => [glow.ProcStartFlipbook!, glow.ProcLoopFlipbook!].every((art) => isShownThroughMasks(art)));
}

/** The glows beside the icons of the Cooldown Manager. */
function countIconGlows(world: World): number {
    return world.frames.filter(
        (frame) =>
            frame.parent?.parent === (UIParent as unknown as FakeFrame) &&
            frame.template === "ActionButtonSpellAlertTemplate" &&
            frame.isShown,
    ).length;
}

describe("the addon's rule on Unsealed Wrath at 3 stacks, out of a fight", () => {
    it("glows at 3 stacks, not at 2 or with no aura", () => {
        expect(isGlowSeen(createPaladin(3))).toBe(true);
        expect(listGlows(createPaladin(2)).length).toBe(0);
        expect(listGlows(createPaladin(undefined)).length).toBe(0);
    });

    it("goes out as the stacks are spent", () => {
        const world = createPaladin(3);
        world.state.auras.length = 0;
        world.advance(1);
        expect(listGlows(world).length).toBe(0);
    });

    it("glows only with the rules on, and not once switched off on the Proc rules tab", () => {
        expect(listGlows(createPaladin(3, { shouldUseProcRules: false })).length).toBe(0);
        const off = { disabledProcRules: { [`${UNSEALED_WRATH.id}:buffStacks:${UNSEALED_WRATH.id}`]: true } };
        expect(listGlows(createPaladin(3, off)).length).toBe(0);
    });
});

describe("the addon's rule on Unsealed Wrath in a fight, the stacks hidden", () => {
    it("lets the glow through at 3 secret stacks", () => {
        const world = createPaladin(undefined);
        enterFight(world, { applications: createSecretNumber(3) });
        expect(isGlowSeen(world)).toBe(true);
    });

    it("keeps it dark at 2 secret stacks: lit, but masked", () => {
        const world = createPaladin(undefined);
        enterFight(world, { applications: createSecretNumber(2) });
        expect(listGlows(world).length).toBe(1);
        expect(isGlowSeen(world)).toBe(false);
    });

    it("follows the stacks as they change, the gate kept", () => {
        const world = createPaladin(undefined);
        enterFight(world, { applications: createSecretNumber(2) });
        world.state.trackedBuffs[0]!.applications = createSecretNumber(3);
        world.advance(1);
        expect(isGlowSeen(world)).toBe(true);
        world.state.trackedBuffs[0]!.applications = createSecretNumber(1);
        world.advance(1);
        expect(isGlowSeen(world)).toBe(false);
    });

    it("compares stacks the game does not hide itself", () => {
        const world = createPaladin(undefined);
        enterFight(world, { applications: 3 });
        expect(isGlowSeen(world)).toBe(true);
        world.state.trackedBuffs[0]!.applications = 2;
        world.advance(1);
        expect(listGlows(world).length).toBe(0);
    });

    it("glows by no guess: not with the icon's aura all secret, nor with no icon", () => {
        const secretAura = createPaladin(undefined);
        enterFight(secretAura, { isAuraDataSecret: true });
        expect(listGlows(secretAura).length).toBe(0);
        const noIcon = createPaladin(3);
        enterFight(noIcon, undefined);
        expect(listGlows(noIcon).length).toBe(0);
    });

    it("has a gate past the alert's start art (150 wide) on a small button, its mask covering all of the gate", () => {
        const world = createPaladin(undefined);
        const button = (_G as unknown as Record<string, FakeFrame>).ActionButton1!;
        button.SetSize(28, 28);
        enterFight(world, { applications: createSecretNumber(3) });
        const glow = listGlows(world)[0]!;
        const bar = world.frames.find((frame) => frame.frameType === "StatusBar" && frame.parent === glow)!;
        const pad = bar.anchorX!;
        expect(glow.width / 2 + pad).toBeGreaterThan(75);
        const mask = glow.ProcLoopFlipbook!.masks![0]!;
        expect(mask.width).toBeGreaterThan(glow.width + pad * 2 - 1);
        expect(mask.height).toBeGreaterThan(glow.height + pad * 2 - 1);
    });

    it("is dark with the buff gone from its icon", () => {
        const world = createPaladin(undefined);
        enterFight(world, { applications: createSecretNumber(3) });
        world.state.trackedBuffs[0]!.isActive = false;
        world.advance(1);
        expect(listGlows(world).length).toBe(0);
    });
});

describe("the glow on Unsealed Wrath's own icon in the Cooldown Manager", () => {
    function createWithIcon(saved: Record<string, unknown>): World {
        const world = createWorld(
            (state) => {
                playAs(state, PALADIN);
                learnSpell(state, UNSEALED_WRATH);
                state.auras.push({ name: UNSEALED_WRATH.name, spellId: UNSEALED_WRATH.id, expirationTime: 1015, stacks: 3 });
                state.trackedBuffs.push({ spellId: UNSEALED_WRATH.id, isActive: true, applications: 3 });
            },
            { ...RULES_ON, ...saved },
        );
        world.advance(1);
        return world;
    }

    it("is lit in Tracked Buffs, though the glow on its icons is not switched on", () => {
        expect(countIconGlows(createWithIcon(ICONS_SHOWN))).toBe(1);
    });

    it("is not lit while the addon keeps Tracked Buffs out of sight", () => {
        expect(countIconGlows(createWithIcon({}))).toBe(0);
    });

    it("is not lit with the Cooldown Manager left alone", () => {
        expect(countIconGlows(createWithIcon({ ...ICONS_SHOWN, cooldownManagerAccess: "off" }))).toBe(0);
    });
});

describe("a rule of the player's on a buff's stacks", () => {
    function createPaladinWithRules(): World {
        const world = createWorld((state) => {
            playAs(state, PALADIN);
            learnSpell(state, HOLY_STRIKE);
            learnSpell(state, UNSEALED_WRATH);
            state.bars[1] = HOLY_STRIKE.id;
        }, RULES_ON);
        world.advance(1);
        return world;
    }

    function findFrameOf(world: World, words: string): FakeFrame | undefined {
        const isShown = (frame: FakeFrame | undefined): boolean => frame === undefined || (frame.isShown && isShown(frame.parent));
        return world.frames.find((frame) => isShown(frame) && frame.fontStrings.some((text) => text.text === words));
    }

    function listParts(world: World, frame: FakeFrame, frameType: string): FakeFrame[] {
        return world.frames.filter((other) => other.parent === frame && other.frameType === frameType);
    }

    /** Adds Holy Strike at these stacks of Unsealed Wrath by the add row of the Proc rules tab. */
    function addStackRule(world: World, stacks: string): void {
        toggleTable();
        showTab(world, "Proc rules");
        const addRow = findFrameOf(world, "Add a rule")!;
        const [spell, buff, , , stacksBox] = listParts(world, addRow, "EditBox");
        const [conditionButton, , addButton] = listParts(world, addRow, "Button");
        world.pickFromMenu(conditionButton!, "Buff at stacks");
        spell!.text = `${HOLY_STRIKE.id}`;
        buff!.text = `${UNSEALED_WRATH.id}`;
        stacksBox!.text = stacks;
        addButton!.scripts.OnClick!(addButton!);
    }

    it("is added with its stacks, glows only at them, and has a row of its own on the Procs tab", () => {
        const world = createPaladinWithRules();
        addStackRule(world, "2");
        expect(world.getSavedSettings()!.procRules).toEqual([
            { spellId: HOLY_STRIKE.id, kind: "buffStacks", value: UNSEALED_WRATH.id, stacks: 2, result: "glow", priority: 1 },
        ]);
        showTab(world, "Procs");
        expect(findRow(world, "Holy Strike (2 stacks)")).toBeDefined();
        world.state.auras.push({ name: UNSEALED_WRATH.name, spellId: UNSEALED_WRATH.id, expirationTime: 1015, stacks: 1 });
        world.advance(1);
        expect(listGlows(world).length).toBe(0);
        world.state.auras[0]!.stacks = 2;
        world.advance(1);
        expect(isGlowSeen(world)).toBe(true);
    });

    it("is refused without its stacks, and the chat says why", () => {
        const world = createPaladinWithRules();
        addStackRule(world, "");
        expect(world.getSavedSettings()!.procRules).toEqual([]);
        expect(world.chat[world.chat.length - 1]).toContain("Enter the stacks");
    });
});
