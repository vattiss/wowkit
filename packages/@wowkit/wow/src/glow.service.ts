// A glow on action buttons: Blizzard's spell-alert ("proc") animation, tinted with a color. The round buttons of Forever's
// gamepad bars get the client's own round highlight instead, pulsing: the square alert does not fit them.
//
// A glow on a button of the gamepad bars is a frame of our own beside it, never its child: the gamepad bars' code goes
// through the children of its buttons, and a frame an addon made there taints it (the game then blocks its
// SetPreferredGamepadInteractTarget). The glow follows the button through hooks on its showing and hiding instead.

import type { ActionBarsService } from "./action-bars.service";
import { tryCall } from "./utils/protected-call.utils";
import type { HiddenAlpha } from "./value-curves.service";

/** A color as red, green and blue between 0 and 1. */
export type Rgb = [r: number, g: number, b: number];

/** Fallback art if the spell-alert glow template is missing; built-in client art only. */
const GLOW_FALLBACK = "Interface\\Cooldown\\star4";
const GLOW_SCALE = 1.45;
const GLOW_ALPHA = 0.95;
/**
 * The glow of a round gamepad button, in two layers of the client's own gamepad art: a soft round halo well around the
 * button (the glow it flashes when a cast completes), and the ring it highlights the button with.
 */
const RING_ATLAS = "gamepad-actionbar-circleslot-border-hover";
const RING_SCALE = 1.2;
const HALO_ATLAS = "gamepad-hud-actionbar-casting-complete-glow";
/** The halo's size, against the ring's. */
const HALO_SCALE = 1.35;
/** The two pulse together between full and this opacity, half a second each way. */
const RING_PULSE_ALPHA = 0.45;
const RING_PULSE_SECONDS = 0.5;

interface Overlay {
    frame: Frame;
    alert?: SpellAlertFrame;
    texture?: Texture;
    /** The glow is lit (it shows while its button does). */
    isWanted?: boolean;
    /** A frame beside the button, not its child (a button of the gamepad bars). */
    isBeside?: boolean;
    /** The ring of a round button; its halo is drawn around it. */
    isRing?: boolean;
    halo?: Texture;
}

export interface ButtonGlow {
    /** Glows the buttons of these spells in the color; an empty list clears. */
    show: (this: void, spellIds: number[], color: Rgb) => void;
    clear: (this: void) => void;
    /**
     * The opacity of the glowing buttons: a curve result the client computed from a hidden value (see
     * ValueCurvesService), or a number; undefined is the glow's own opacity again.
     */
    setAlpha: (this: void, alpha: HiddenAlpha | number | undefined) => void;
}

export class GlowService {
    /** Overlays per button and reminder kind. Kept here, never written onto Blizzard's buttons. */
    private readonly overlays = new LuaMap<ActionButton, LuaMap<string, Overlay>>();
    /** The gamepad buttons whose showing and hiding the glows beside them follow. */
    private readonly tracked = new LuaSet<ActionButton>();
    /** The pulses of the round glows that show: they restart together, so every ring pulses in step. */
    private readonly pulses = new LuaSet<AnimationGroup>();

    constructor(private readonly actionBars: ActionBarsService) {}

    /**
     * One glow on the buttons of some spells; each kind (the buff, the weapon buff) keeps its own overlays.
     * `isButtonShown` leaves buttons out (a bar the player does not want to glow); it is asked each time the glow is shown.
     */
    createButtonGlow(kind: string, isButtonShown?: (this: void, button: ActionButton) => boolean): ButtonGlow {
        const glowing = new LuaSet<ActionButton>();
        let last: string | undefined;
        const clearGlow = () => {
            for (const button of glowing) {
                const entry = this.overlays.get(button)?.get(kind);
                if (entry) {
                    entry.isWanted = false;
                    entry.frame.Hide();
                }
                glowing.delete(button);
            }
            last = undefined;
        };
        return {
            clear: clearGlow,
            setAlpha: (alpha) => {
                for (const button of glowing) {
                    // The client accepts the secret curve result here; addon code never reads it
                    this.overlays
                        .get(button)
                        ?.get(kind)
                        ?.frame.SetAlpha((alpha ?? GLOW_ALPHA) as number);
                }
            },
            show: (spellIds, color) => {
                if (spellIds.length === 0) return clearGlow();
                // The color is part of the key: the same spell may glow in another color (a heal that turns urgent)
                const key = `${spellIds.join(",")}|${color.join(",")}`;
                const buttons = spellIds
                    .flatMap((spellId) => this.actionBars.findButtonsOf(spellId))
                    .filter((button) => isButtonShown === undefined || isButtonShown(button));
                // The same spells on the same buttons: nothing to redraw. The buttons count too: the bars are mapped a few
                // buttons a frame, so a spell may be found on more buttons than when it was first lit
                if (key === last && !glowing.isEmpty() && this.isSameButtons(glowing, buttons)) return;
                clearGlow();
                last = key;
                for (const button of buttons) {
                    if (!glowing.has(button)) {
                        const entry = this.getOverlay(button, kind, color);
                        entry.isWanted = true;
                        // A glow beside its button shows only while the button does (see trackButton)
                        if (entry.isBeside !== true || button.IsVisible()) entry.frame.Show();
                        glowing.add(button);
                    }
                }
            },
        };
    }

    /** Does the glow already light exactly these buttons? */
    private isSameButtons(glowing: LuaSet<ActionButton>, buttons: ActionButton[]): boolean {
        const wanted = new LuaSet<ActionButton>();
        for (const button of buttons) {
            if (!glowing.has(button)) return false;
            wanted.add(button);
        }
        // Every wanted button glows already; none glows that is not wanted
        for (const button of glowing) if (!wanted.has(button)) return false;
        return true;
    }

    private getOverlay(button: ActionButton, kind: string, [r, g, b]: Rgb): Overlay {
        let byKind = this.overlays.get(button);
        if (!byKind) {
            byKind = new LuaMap();
            this.overlays.set(button, byKind);
        }
        let entry = byKind.get(kind);
        if (!entry) {
            entry = this.createOverlay(button);
            byKind.set(kind, entry);
        }
        this.applySize(entry, button);
        if (entry.alert) {
            // Desaturated, so the reminder color tints the glow instead of mixing with gold
            for (const texture of [entry.alert.ProcStartFlipbook, entry.alert.ProcLoopFlipbook]) {
                texture?.SetDesaturated(true);
                texture?.SetVertexColor(r, g, b);
            }
            entry.frame.SetAlpha(GLOW_ALPHA);
        } else {
            entry.texture!.SetVertexColor(r, g, b, GLOW_ALPHA);
            entry.halo?.SetVertexColor(r, g, b, GLOW_ALPHA);
        }
        return entry;
    }

    /** The glow is a little larger than its button (a size the client has not laid out yet counts as 36). */
    private applySize(entry: Overlay, button: ActionButton): void {
        const width = button.GetWidth();
        const height = button.GetHeight();
        // A glow beside the button is sized in its own parent's scale
        const scale = (entry.isRing === true ? RING_SCALE : GLOW_SCALE) * (entry.isBeside === true ? this.getScaleRatio(button) : 1);
        entry.frame.SetSize((width < 8 ? 36 : width) * scale, (height < 8 ? 36 : height) * scale);
        entry.halo?.SetSize(entry.frame.GetWidth() * HALO_SCALE, entry.frame.GetHeight() * HALO_SCALE);
    }

    /** A button of the gamepad bars (Forever): they say their shape, round or square. */
    private isGamepadButton(button: ActionButton): boolean {
        return (button as { activeButtonShape?: unknown }).activeButtonShape !== undefined;
    }

    /** How much larger the button is drawn than a frame of the screen (the gamepad bars have a scale of their own). */
    private getScaleRatio(button: ActionButton): number {
        const screenScale = UIParent.GetEffectiveScale();
        return screenScale > 0 ? button.GetEffectiveScale() / screenScale : 1;
    }

    /** The glows beside a gamepad button hide with it, and show again with it while they are lit. */
    private trackButton(button: ActionButton): void {
        if (this.tracked.has(button)) return;
        this.tracked.add(button);
        // HookScript runs after the button's own script and leaves it untainted
        button.HookScript("OnHide", () => {
            for (const [, entry] of this.overlays.get(button) ?? new LuaMap<string, Overlay>()) entry.frame.Hide();
        });
        button.HookScript("OnShow", () => {
            for (const [, entry] of this.overlays.get(button) ?? new LuaMap<string, Overlay>())
                if (entry.isWanted === true) entry.frame.Show();
        });
    }

    private createOverlay(button: ActionButton): Overlay {
        if (!this.isGamepadButton(button)) return this.createOverlayIn(button, button);
        this.trackButton(button);
        const overlay = this.createOverlayIn(UIParent, button);
        overlay.isBeside = true;
        overlay.frame.SetFrameStrata(button.GetFrameStrata());
        return overlay;
    }

    /** The glow of the button, made in `parent`: the button itself, or the screen for a button of the gamepad bars. */
    private createOverlayIn(parent: Frame, button: ActionButton): Overlay {
        const level = button.GetFrameLevel() + 6;
        if (this.isRoundButton(button)) return this.createRing(parent, button, level);
        // Blizzard's own spell-alert glow, but our own instance, never the one the action bar manager
        // drives, so real procs are unaffected
        const [didSucceed, created] = tryCall(() => CreateFrame("Frame", undefined, parent, "ActionButtonSpellAlertTemplate"));
        const alert = didSucceed ? (created as SpellAlertFrame) : undefined;
        if (alert?.ProcStartAnim && alert.ProcLoop) {
            alert.SetFrameStrata("MEDIUM");
            alert.SetFrameLevel(level);
            alert.SetPoint("CENTER", button, "CENTER", 0, 0);
            alert.SetScript("OnShow", () => {
                alert.ProcLoop!.Stop();
                alert.ProcStartAnim!.Play();
            });
            alert.SetScript("OnHide", () => {
                alert.ProcStartAnim!.Stop();
                alert.ProcLoop!.Stop();
            });
            alert.ProcAltGlow?.Hide();
            alert.Hide();
            return { frame: alert, alert };
        }
        const frame = CreateFrame("Frame", undefined, parent);
        frame.SetFrameStrata("MEDIUM");
        frame.SetFrameLevel(level);
        frame.SetPoint("CENTER", button, "CENTER", 0, 0);
        const texture = frame.CreateTexture(undefined, "OVERLAY");
        texture.SetAllPoints(frame);
        texture.SetTexture(GLOW_FALLBACK);
        texture.SetBlendMode("ADD");
        frame.Hide();
        return { frame, texture };
    }

    /** A round button of the gamepad bars (Forever): they say their shape themselves. */
    private isRoundButton(button: ActionButton): boolean {
        return (button as { activeButtonShape?: unknown }).activeButtonShape === "Circle";
    }

    /** The client's round halo and highlight around the button (the art of the gamepad bars), pulsing. */
    private createRing(parent: Frame, button: ActionButton, level: number): Overlay {
        const frame = CreateFrame("Frame", undefined, parent);
        frame.SetFrameStrata("MEDIUM");
        frame.SetFrameLevel(level);
        frame.SetPoint("CENTER", button, "CENTER", 0, 0);
        // The pulse is on a frame of its own: the overlay's opacity is the glow's (see setAlpha)
        const pulsing = CreateFrame("Frame", undefined, frame);
        pulsing.SetAllPoints(frame);
        const halo = this.createRingLayer(pulsing, HALO_ATLAS, "ARTWORK");
        halo.SetPoint("CENTER", pulsing, "CENTER", 0, 0);
        const texture = this.createRingLayer(pulsing, RING_ATLAS, "OVERLAY");
        texture.SetAllPoints(pulsing);
        // (A client, or the fake game, without animations keeps a steady glow)
        const pulse = pulsing.CreateAnimationGroup() as AnimationGroup | undefined;
        const fade = pulse?.CreateAnimation("Alpha") as AlphaAnimation | undefined;
        if (pulse !== undefined && fade !== undefined) {
            fade.SetFromAlpha(1);
            fade.SetToAlpha(RING_PULSE_ALPHA);
            fade.SetDuration(RING_PULSE_SECONDS);
            pulse.SetLooping("BOUNCE");
            frame.SetScript("OnShow", () => {
                this.pulses.add(pulse);
                this.syncPulses();
            });
            frame.SetScript("OnHide", () => {
                pulse.Stop();
                this.pulses.delete(pulse);
            });
        }
        frame.Hide();
        return { frame, texture, halo, isRing: true };
    }

    /** Every round glow that shows pulses from the start again, in step with the one that just lit. */
    private syncPulses(): void {
        for (const pulse of this.pulses) {
            pulse.Stop();
            pulse.Play();
        }
    }

    /** One layer of a round glow: the art in gray, so the reminder's color tints it instead of mixing with its gold. */
    private createRingLayer(frame: Frame, atlas: string, layer: DrawLayer): Texture {
        const texture = frame.CreateTexture(undefined, layer);
        texture.SetAtlas(atlas);
        texture.SetDesaturated(true);
        texture.SetBlendMode("ADD");
        return texture;
    }
}
