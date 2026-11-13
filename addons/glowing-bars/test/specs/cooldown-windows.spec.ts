import {
    BATTLE_SHOUT,
    createWorld,
    describe,
    expect,
    INNER_FIRE,
    it,
    learnSpell,
    playAs,
    PRIEST,
    SHAMAN,
    WARRIOR,
    type FakeFrame,
    type World,
} from "@wowkit/test-kit";

const VISIBLE_SETTING = 6;
const HIDDEN = 2;
const ALWAYS = 0;
const IN_COMBAT = 1;
const COOLDOWN_VIEWER_SYSTEM = 20;

describe("a window of the Cooldown Manager that is not running", () => {
    /** A priest in a fight, Inner Fire just cast, its icon frozen on "not up". */
    function createFight(hiddenViewers: string[]): World {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.bars[1] = INNER_FIRE.id;
            state.isInCombat = true;
            state.areAurasHidden = true;
            state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: true });
        });
        world.advance(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", INNER_FIRE.id);
        world.advance(1);
        world.state.trackedBuffs[0]!.isActive = false;
        world.state.hiddenViewers = hiddenViewers;
        world.advance(1);
        return world;
    }

    it("is believed while it runs", () => {
        expect(createFight([]).glowsOn(1)).toBe(1);
    });

    it("has no say once hidden: the buff just cast keeps quiet", () => {
        expect(createFight(["BuffIconCooldownViewer"]).glowsOn(1)).toBe(0);
    });

    it("is not a window the addon keeps invisible", () => {
        const world = createFight([]);
        expect(world.state.viewerAlpha).toBe(0);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("hiding the windows one by one", () => {
    it("leaves the others on the screen, the bars of the tracked buffs going with their icons", () => {
        const world = createWorld((state) => playAs(state, SHAMAN), {
            isCooldownManagerSetUp: true,
            trackedBuffsIcons: "hide",
            essentialIcons: "show",
            utilityIcons: "hide",
        });
        world.advance(1);
        expect(world.state.windowAlphas["BuffIconCooldownViewer"]).toBe(0);
        expect(world.state.windowAlphas["BuffBarCooldownViewer"]).toBe(0);
        expect(world.state.windowAlphas["EssentialCooldownViewer"]).toBe(1);
        expect(world.state.windowAlphas["UtilityCooldownViewer"]).toBe(0);
    });
});

describe("Tracked Bars, a window of its own", () => {
    it("starts as Tracked Buffs was, for a player from before it had its own setting", () => {
        const world = createWorld((state) => playAs(state, SHAMAN), { isCooldownManagerSetUp: true, trackedBuffsIcons: "show" });
        world.advance(1);
        expect(world.getSavedSettings()?.trackedBarsIcons).toBe("show");
        expect(world.state.windowAlphas["BuffBarCooldownViewer"]).toBe(1);
    });

    it("is hidden or shown on its own", () => {
        const world = createWorld((state) => playAs(state, SHAMAN), {
            isCooldownManagerSetUp: true,
            isTrackedBarsSplit: true,
            trackedBuffsIcons: "show",
            trackedBarsIcons: "hide",
        });
        world.advance(1);
        expect(world.state.windowAlphas["BuffIconCooldownViewer"]).toBe(1);
        expect(world.state.windowAlphas["BuffBarCooldownViewer"]).toBe(0);
    });

    it("tells a buff the player keeps there, Battle Shout only as a bar, in a fight", () => {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            learnSpell(state, BATTLE_SHOUT);
            state.bars[1] = BATTLE_SHOUT.id;
            state.isInCombat = true;
            state.areAurasHidden = true;
            state.trackedBuffs.push({ spellId: BATTLE_SHOUT.id, isActive: true, isBar: true });
        });
        world.advance(1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", BATTLE_SHOUT.id);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        // The bar says it is gone, before its usual time
        world.state.trackedBuffs[0]!.isActive = false;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("glows on the icon of a bar, once switched on", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.bars[1] = INNER_FIRE.id;
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false, isBar: true });
            },
            { isCooldownManagerSetUp: true, isTrackedBarsSplit: true, trackedBarsIcons: "show", barsThatGlow: { trackedBars: true } },
        );
        world.advance(3);
        // Beside the icon of the bar: in a holder on the screen, as on the icons of the other windows
        const besideIcons = world.frames.filter(
            (frame) =>
                frame.parent?.parent === (UIParent as unknown as FakeFrame) &&
                frame.template === "ActionButtonSpellAlertTemplate" &&
                frame.isShown,
        );
        expect(besideIcons.length).toBe(1);
        // On the icon at the end of the bar, not on the bar, which carries the cooldown ID
        expect(type((besideIcons[0]!.anchor as unknown as { cooldownID?: unknown }).cooldownID)).not.toBe("number");
    });
});

describe("a window kept out of sight that the game shows again", () => {
    function createWorldWithHiddenWindow(): World {
        const world = createWorld((state) => playAs(state, SHAMAN), {
            isCooldownManagerSetUp: true,
            essentialIcons: "hide",
            utilityIcons: "show",
        });
        world.advance(1);
        return world;
    }

    it("is hidden again soon after", () => {
        const world = createWorldWithHiddenWindow();
        world.state.windowAlphas["EssentialCooldownViewer"] = 1;
        world.advance(2);
        expect(world.state.windowAlphas["EssentialCooldownViewer"]).toBe(0);
    });

    it("leaves the windows the player chose to show", () => {
        const world = createWorldWithHiddenWindow();
        world.advance(2);
        expect(world.state.windowAlphas["UtilityCooldownViewer"]).toBe(1);
    });

    it("waits for the end of a fight", () => {
        const world = createWorldWithHiddenWindow();
        world.state.isInCombat = true;
        world.state.windowAlphas["EssentialCooldownViewer"] = 1;
        world.advance(2);
        expect(world.state.windowAlphas["EssentialCooldownViewer"]).toBe(1);
    });
});

describe("repairing the hidden windows", () => {
    const ACCOUNT_LAYOUT = 1;

    function createLayouts(value: number, activeLayout = 3, saved: Record<string, unknown> = {}): World {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            state.editModeLayouts = {
                activeLayout,
                layouts: [
                    {
                        layoutName: "Mine",
                        layoutType: ACCOUNT_LAYOUT as Enum.EditModeLayoutType,
                        systems: [
                            {
                                system: COOLDOWN_VIEWER_SYSTEM as Enum.EditModeSystem,
                                settings: [{ setting: VISIBLE_SETTING, value }],
                            } as EditModeSystemInfo,
                        ],
                    },
                ],
            };
        }, saved);
        world.advance(1);
        return world;
    }

    function clickRepair(world: World): void {
        world.openOptions();
        world.clickOption("Repair Hidden Windows");
    }

    it("sets a hidden window to always show, saved with the presets first, and reloads", () => {
        const world = createLayouts(HIDDEN);
        clickRepair(world);
        expect(world.state.editModeSaves).toBe(1);
        expect(world.state.editModeLayouts.layouts[2]!.systems[0]!.settings[0]!.value).toBe(ALWAYS);
        expect(world.state.reloads).toBe(1);
    });

    it("is only offered when a window is hidden", () => {
        const hidden = createLayouts(HIDDEN);
        hidden.openOptions();
        expect(hidden.isOptionShown("Repair Hidden Windows")).toBe(true);
        const notHidden = createLayouts(IN_COMBAT);
        notHidden.openOptions();
        expect(notHidden.isOptionShown("Repair Hidden Windows")).toBe(false);
    });

    it("is not offered for a preset, which cannot be changed", () => {
        const world = createLayouts(HIDDEN, 1);
        world.openOptions();
        expect(world.isOptionShown("Repair Hidden Windows")).toBe(false);
    });

    it("waits for the end of a fight", () => {
        const world = createLayouts(HIDDEN);
        world.state.isInCombat = true;
        clickRepair(world);
        expect(world.state.editModeSaves).toBe(0);
    });

    it("is not offered when EllesmereUI runs the windows", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            state.loadedAddons.EllesmereUICooldownManager = true;
        });
        world.advance(1);
        world.openOptions();
        expect(world.isOptionShown("Repair Hidden Windows")).toBe(false);
    });
});

describe("a glow beside a Cooldown Manager icon that its window makes transparent (issue #71)", () => {
    /** A priest whose Inner Fire glows on its Tracked Buffs icon too, shown as transparent as `alpha`. */
    function createWorldWithIcon(alpha: number): World {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, INNER_FIRE);
                state.bars[1] = INNER_FIRE.id;
                state.trackedBuffs.push({ spellId: INNER_FIRE.id, isActive: false, effectiveAlpha: alpha });
            },
            { isCooldownManagerSetUp: true, trackedBuffsIcons: "show", barsThatGlow: { trackedBuffs: true } },
        );
        world.advance(3);
        return world;
    }

    /** The holders of the glows beside the icons that are lit: how transparent each is. */
    function readHolderAlphas(world: World): number[] {
        return world.frames
            .filter((frame) => frame.parent?.parent === (UIParent as unknown as FakeFrame) && frame.isShown)
            .filter((frame) => frame.template === "ActionButtonSpellAlertTemplate")
            .map((frame) => frame.parent!.alpha);
    }

    it("takes the icon's transparency: none at all while the icon cannot be seen", () => {
        const world = createWorldWithIcon(0);
        expect(world.glowsOn(1)).toBe(1);
        expect(readHolderAlphas(world).join(",")).toBe("0");
    });

    it("is as faint as a half transparent icon, and full once the window shows it again", () => {
        const world = createWorldWithIcon(0.5);
        expect(readHolderAlphas(world).join(",")).toBe("0.5");
        world.state.trackedBuffs[0]!.effectiveAlpha = 1;
        world.advance(1);
        expect(readHolderAlphas(world).join(",")).toBe("1");
    });
});
