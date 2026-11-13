import {
    createWorld,
    describe,
    expect,
    type FakeFrame,
    INNER_FIRE,
    it,
    learnSpell,
    PALADIN,
    playAs,
    PRIEST,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

interface GlowingBarsApi {
    RegisterStanceButton: (this: void, button: unknown, stance: number) => void;
}

const DEVOTION_AURA: SpellDefinition = { id: 465, name: "Devotion Aura", rank: 1, icon: 135893, isHelpful: true };
const STANCE_BUTTON = "MyBarsStanceButton1";

function createPaladin(saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        learnSpell(state, DEVOTION_AURA);
        state.stances = [DEVOTION_AURA.id];
    }, saved);
    (_G as unknown as { GlowingBars: GlowingBarsApi }).GlowingBars.RegisterStanceButton(CreateFrame("CheckButton", STANCE_BUTTON), 1);
    world.advance(3);
    return world;
}

const ICONS_SHOWN = { trackedBuffsIcons: "show", essentialIcons: "show", utilityIcons: "show" };

describe("the Stance Bar", () => {
    it("glows by default", () => {
        expect(createPaladin({}).glowsOnFrame(STANCE_BUTTON)).toBe(1);
    });

    it("does not glow when switched off", () => {
        expect(createPaladin({ barsThatGlow: { stance: false } }).glowsOnFrame(STANCE_BUTTON)).toBe(0);
    });

    it("fades until it glows", () => {
        const world = createPaladin({ fadedBars: { stance: true }, barsThatGlow: { stance: false } });
        expect(world.findFrame((frame) => frame.name === STANCE_BUTTON)!.alpha).toBe(0.5);
    });
});

/** A priest missing Inner Fire, with an icon for it in the Cooldown Manager. */
function createPriest(saved: Record<string, unknown>): World {
    const world = createWorld(
        (state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.bars[1] = INNER_FIRE.id;
            state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false });
        },
        { isCooldownManagerSetUp: true, ...saved },
    );
    world.advance(3);
    return world;
}

/** The glows that are the addon's own frames beside an icon. */
function countIconGlows(world: World): number {
    return world.frames.filter(
        (frame) =>
            frame.parent?.parent === (UIParent as unknown as FakeFrame) &&
            frame.template === "ActionButtonSpellAlertTemplate" &&
            frame.isShown,
    ).length;
}

describe("the glow on the Cooldown Manager's icons", () => {
    it("is off by default, and can be switched on", () => {
        expect(countIconGlows(createPriest({ ...ICONS_SHOWN }))).toBe(0);
        expect(countIconGlows(createPriest({ ...ICONS_SHOWN, barsThatGlow: { trackedBuffs: true } }))).toBe(1);
    });

    it("lights the icon of the spell when it is switched on", () => {
        expect(countIconGlows(createPriest({ barsThatGlow: { trackedBuffs: true }, ...ICONS_SHOWN }))).toBe(1);
    });

    it("goes out when it is switched off in the options, and comes back", () => {
        const world = createPriest({ barsThatGlow: { trackedBuffs: true }, ...ICONS_SHOWN });
        world.setOption("bar_trackedBuffs", false);
        world.advance(1);
        expect(countIconGlows(world)).toBe(0);
        world.setOption("bar_trackedBuffs", true);
        world.advance(1);
        expect(countIconGlows(world)).toBe(1);
    });

    it("goes by the window: a spell in Utility does not light from Tracked Buffs being on", () => {
        const createInUtility = (window: string) => {
            const world = createWorld(
                (state) => {
                    playAs(state, PRIEST);
                    learnSpell(state, INNER_FIRE);
                    state.bars[1] = INNER_FIRE.id;
                    state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false, isInSpellsTab: true, isOwnBuff: true });
                },
                { isCooldownManagerSetUp: true, ...ICONS_SHOWN, barsThatGlow: { utility: window === "utility" } },
            );
            world.advance(3);
            return world;
        };
        expect(countIconGlows(createInUtility("trackedBuffs"))).toBe(0);
        expect(countIconGlows(createInUtility("utility"))).toBe(1);
    });

    it("stays off while the icons are hidden", () => {
        expect(countIconGlows(createPriest({ barsThatGlow: { trackedBuffs: true }, trackedBuffsIcons: "hide" }))).toBe(0);
    });

    it("works on EllesmereUI's bars, which show the icons themselves", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.bars[1] = INNER_FIRE.id;
                state.loadedAddons.EllesmereUICooldownManager = true;
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false });
            },
            { isCooldownManagerSetUp: true, barsThatGlow: { trackedBuffs: true } },
        );
        world.advance(3);
        expect(countIconGlows(world)).toBe(1);
    });
});

describe("a spell only in the Cooldown Manager, on no action bar", () => {
    function createWithIcon(saved: Record<string, unknown>, isDrawn = true): World {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false, isDrawn });
            },
            { isCooldownManagerSetUp: true, ...ICONS_SHOWN, ...saved },
        );
        world.advance(3);
        return world;
    }

    it("glows on its icon", () => {
        expect(countIconGlows(createWithIcon({ barsThatGlow: { trackedBuffs: true } }))).toBe(1);
    });

    it("is not reminded of when the glow on the icons is off", () => {
        expect(countIconGlows(createWithIcon({ barsThatGlow: { trackedBuffs: false } }))).toBe(0);
    });

    it("is not reminded of while its icon is not drawn", () => {
        expect(countIconGlows(createWithIcon({ barsThatGlow: { trackedBuffs: true } }, false))).toBe(0);
    });
});

describe("fading the Cooldown Manager's icons", () => {
    it("fades an icon that does not glow", () => {
        const world = createPriest({
            fadedBars: { trackedBuffs: true },
            barsThatGlow: { trackedBuffs: false },
            ...ICONS_SHOWN,
        });
        expect(world.state.trackedBuffs[0]!.iconAlpha).toBe(0.5);
    });

    it("shows a glowing icon in full", () => {
        const world = createPriest({
            fadedBars: { trackedBuffs: true },
            barsThatGlow: { trackedBuffs: true },
            ...ICONS_SHOWN,
        });
        expect(world.state.trackedBuffs[0]!.iconAlpha).toBe(1);
    });
});
