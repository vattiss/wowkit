// A glow on action buttons: Blizzard's spell-alert ("proc") animation, tinted with a color, in one of three styles (see
// GlowAnimation). The round buttons of Forever's gamepad bars get the client's own round highlight instead, breathing or
// still: the square alert does not fit them; so do the buttons another addon registered as round. Every breathing glow
// breathes in step.
//
// A glow on a button of the gamepad bars is a frame of our own beside it, never its child: the gamepad bars' code goes
// through the children of its buttons, and a frame an addon made there taints it (the game then blocks its
// SetPreferredGamepadInteractTarget). The glow follows the button through hooks on its showing and hiding instead.

import { isSameButtons } from "./utils/glow-buttons.utils";
import type { Overlay } from "./utils/glow-overlay.interface";
import { isBreathing, isStill, type GlowAnimation } from "./utils/glow-animation.utils";
import {
    GLOW_FALLBACK,
    GLOW_SCALE,
    GLOW_ALPHA,
    RING_ATLAS,
    RING_SCALE,
    HALO_ATLAS,
    HALO_SCALE,
    RING_PULSE_ALPHA,
    RING_PULSE_SECONDS,
    LOOP_ATLAS,
} from "./utils/glow-look.constants";
import { showLoopPicture } from "./utils/glow-picture.utils";
import { createLineGlow } from "./utils/glow-line.utils";
import { BORDER_SCALE, createSoftFrame } from "./utils/glow-border.utils";
import { createStillFades } from "./utils/glow-fade.utils";
import type { ActionBarsService } from "./action-bars.service";
import { attempt, tryCall } from "./utils/protected-call.utils";
import { getReadable } from "./utils/secret-value.utils";
import type { HiddenAlpha } from "./value-curves.service";

/** A color as red, green and blue between 0 and 1. */
export type Rgb = [r: number, g: number, b: number];

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

export { isBreathing, isStill, type GlowAnimation };

export class GlowService {
    /** Overlays per button and reminder type. Kept here, never written onto Blizzard's buttons. */
    private readonly overlays = new LuaMap<ActionButton, LuaMap<string, Overlay>>();
    /**
     * The last readable size of each button, and its scale against the screen: in combat the client keeps a protected
     * button's geometry secret, and a secret value cannot even be compared.
     */
    private readonly sizes = new LuaMap<ActionButton, [width: number, height: number, scale: number]>();
    /** The gamepad buttons whose showing and hiding the glows beside them follow. */
    private readonly tracked = new LuaSet<ActionButton>();
    /** The breathing of the glows that show (round, or square and breathing): they restart together, in step. */
    private readonly pulses = new LuaSet<AnimationGroup>();
    /** Other frames a spell can glow on (icons of the Cooldown Manager), and a text that changes when they do. */
    private findExtraTargets: ((this: void, spellId: number) => ActionButton[]) | undefined;
    private getExtraKey: ((this: void) => string) | undefined;
    /** Those frames: their glow is beside them, as they are not the addon's to add children to. */
    private readonly extraTargets = new LuaSet<ActionButton>();
    /** What a circling glow does on a round button, where it cannot circle: breathe, or stand still. */
    private roundAnimation: GlowAnimation = "breathing";

    constructor(private readonly actionBars: ActionBarsService) {}

    /** What a circling glow does on a round button from now on: breathe, or stand still. */
    setRoundAnimation(roundAnimation: GlowAnimation): void {
        this.roundAnimation = roundAnimation;
    }

    /** Lets spells glow on more than their action buttons. */
    useExtraTargets(find: (this: void, spellId: number) => ActionButton[], getKey: (this: void) => string): void {
        this.findExtraTargets = find;
        this.getExtraKey = getKey;
    }

    /** Changes when the extra targets do; empty while there are none to follow. */
    getExtraTargetsKey(): string {
        return this.getExtraKey?.() ?? "";
    }

    /**
     * One glow on the buttons of some spells, moving in `animation`; each type (the buff, the weapon buff) keeps its own
     * overlays. `isButtonShown` leaves buttons out (a bar the player does not want to glow); it is asked each time the glow
     * is shown.
     */
    /** `hasExtraTargets`: the glow goes on the extra targets too (the Cooldown Manager's icons). */
    createButtonGlow(
        glowKey: string,
        animation: GlowAnimation,
        isButtonShown?: (this: void, button: ActionButton) => boolean,
        hasExtraTargets = true,
    ): ButtonGlow {
        const glowing = new LuaSet<ActionButton>();
        let last: string | undefined;
        const clearGlow = () => {
            for (const button of glowing) {
                const entry = this.overlays.get(button)?.get(glowKey);
                if (entry) this.hideOverlay(entry);
                glowing.delete(button);
            }
            last = undefined;
        };
        return {
            clear: clearGlow,
            setAlpha: (alpha) => {
                // The client accepts the secret curve result here; addon code never reads it
                const value = (alpha ?? GLOW_ALPHA) as number;
                for (const button of glowing) this.overlays.get(button)?.get(glowKey)?.frame.SetAlpha(value);
            },
            show: (spellIds, color) => {
                if (spellIds.length === 0) return clearGlow();
                // The color is part of the key: the same spell may glow in another color (a heal that turns urgent)
                const key = `${spellIds.join(",")}|${color.join(",")}`;
                const buttons = spellIds
                    .flatMap((spellId) => this.actionBars.findButtonsOf(spellId))
                    .filter((button) => isButtonShown === undefined || isButtonShown(button));
                for (const target of hasExtraTargets ? spellIds.flatMap((spellId) => this.findExtraTargets?.(spellId) ?? []) : []) {
                    this.extraTargets.add(target);
                    if (!buttons.includes(target)) buttons.push(target);
                }
                // The same spells on the same buttons: nothing to redraw. The buttons count too: the bars are mapped a few
                // buttons a frame, so a spell may be found on more buttons than when it was first lit
                if (key === last && !glowing.isEmpty() && isSameButtons(glowing, buttons)) return;
                clearGlow();
                for (const button of buttons) {
                    if (!glowing.has(button)) {
                        this.showOverlay(this.getOverlay(button, glowKey, color, animation), button);
                        glowing.add(button);
                    }
                }
                // Drawn only once every button is lit: after an error the next tick draws again, it does not take it as done
                last = key;
            },
        };
    }

    /** One button lit on its own, in a glow of its own key. */
    showButtonGlow(glowKey: string, button: ActionButton, color: Rgb, animation: GlowAnimation): void {
        this.showOverlay(this.getOverlay(button, glowKey, color, animation), button);
    }

    clearButtonGlow(glowKey: string, button: ActionButton): void {
        const entry = this.overlays.get(button)?.get(glowKey);
        if (entry !== undefined) this.hideOverlay(entry);
    }

    /** Lights a glow; one that is fading out is back at once, without fading in again. */
    private showOverlay(entry: Overlay, button: ActionButton): void {
        entry.isWanted = true;
        // A glow beside its button shows only while the button does (see trackButton)
        if (entry.isBeside === true && getReadable(attempt(() => button.IsVisible())) !== true) return;
        if (entry.fadeOut?.IsPlaying() === true) entry.fadeOut.Stop();
        else entry.frame.Show();
    }

    /** Puts a glow out; a still one fades out first. */
    private hideOverlay(entry: Overlay): void {
        entry.isWanted = false;
        if (isStill(entry.animation) && entry.fadeOut !== undefined && entry.frame.IsShown()) entry.fadeOut.Play();
        else entry.frame.Hide();
    }

    /** The buttons a glow is lit on, but those of the gamepad bars: their glow is beside them. */
    listGlowing(): ActionButton[] {
        const buttons: ActionButton[] = [];
        for (const [button] of this.overlays) if (this.isGlowing(button) && !this.isBesideButton(button)) buttons.push(button);
        return buttons;
    }

    /** Is a glow lit on the button? */
    isGlowing(button: ActionButton): boolean {
        const entries = this.overlays.get(button);
        if (entries === undefined) return false;
        for (const [, entry] of entries) if (entry.isWanted === true) return true;
        return false;
    }

    private getOverlay(button: ActionButton, key: string, [r, g, b]: Rgb, animation: GlowAnimation): Overlay {
        let byKey = this.overlays.get(button);
        if (!byKey) {
            byKey = new LuaMap();
            this.overlays.set(button, byKey);
        }
        let entry = byKey.get(key);
        if (!entry) {
            entry = this.createOverlay(button, animation);
            byKey.set(key, entry);
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
            for (const part of entry.parts ?? [entry.texture!]) part.SetVertexColor(r, g, b, GLOW_ALPHA);
            entry.halo?.SetVertexColor(r, g, b, GLOW_ALPHA);
        }
        return entry;
    }

    /** The glow is a little larger than its button (a size the client has not laid out yet counts as 36). */
    private applySize(entry: Overlay, button: ActionButton): void {
        const [width, height, buttonScale] = this.readButtonSize(button);
        // A glow beside the button is sized in its own parent's scale
        const scale = (entry.isRing === true ? RING_SCALE : (entry.scale ?? GLOW_SCALE)) * (entry.isBeside === true ? buttonScale : 1);
        entry.frame.SetSize(width * scale, height * scale);
        entry.halo?.SetSize(width * scale * HALO_SCALE, height * scale * HALO_SCALE);
    }

    /** The button's size and scale against the screen: the last readable ones (36 and 1 before any, or not laid out yet). */
    private readButtonSize(button: ActionButton): [width: number, height: number, scale: number] {
        const width = getReadable(button.GetWidth());
        const height = getReadable(button.GetHeight());
        const [screenScale, ownScale] = [getReadable(UIParent.GetEffectiveScale()), getReadable(button.GetEffectiveScale())];
        const scale = screenScale !== undefined && ownScale !== undefined && screenScale > 0 ? ownScale / screenScale : 1;
        if (width !== undefined && height !== undefined && width >= 8 && height >= 8) this.sizes.set(button, [width, height, scale]);
        return this.sizes.get(button) ?? [36, 36, 1];
    }

    /** A button of the gamepad bars (Forever): they say their shape, round or square. Another addon's may too, but it is no such button. */
    private isGamepadButton(button: ActionButton): boolean {
        return (button as { activeButtonShape?: unknown }).activeButtonShape !== undefined && !this.actionBars.isRegistered(button);
    }

    private isBesideButton(button: ActionButton): boolean {
        return this.extraTargets.has(button) || this.isGamepadButton(button);
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

    /**
     * The alert as it shows: the animation from its start, or the loop of the glow stopped on a picture, without the flash
     * it starts with. The loop is stopped a frame after it starts: before, its flipbook shows the whole sheet.
     */
    private startAlert(alert: SpellAlertFrame, fades: Pick<Overlay, "fadeIn" | "breathe" | "animation">): void {
        alert.ProcLoop!.Stop();
        const isCircling = fades.animation === "circling";
        alert.ProcStartFlipbook?.SetShown(isCircling);
        if (isCircling) {
            // The whole flipbook again, hidden until the loop shows it (as the template has it)
            alert.ProcLoopFlipbook?.SetAtlas(LOOP_ATLAS);
            alert.ProcLoopFlipbook?.SetAlpha(0);
            alert.ProcStartAnim!.Play();
            return;
        }
        showLoopPicture(alert, LOOP_ATLAS, () => this.startStill(fades));
    }

    /** A still glow as it lights: it fades in, or starts breathing, in step with the others that breathe. */
    private startStill(fades: Pick<Overlay, "fadeIn" | "breathe" | "animation">): void {
        if (isStill(fades.animation)) fades.fadeIn?.Play();
        else if (fades.breathe !== undefined) {
            this.pulses.add(fades.breathe);
            this.syncPulses();
        }
    }

    /** The drawn border, still: it breathes, or fades in as it lights and out as it goes. */
    private setUpBorder(frame: Frame, inner: Frame, parts: Texture[], animation: GlowAnimation): Overlay {
        const fades = createStillFades(frame, inner);
        frame.SetScript("OnShow", () => this.startStill({ ...fades, animation }));
        frame.SetScript("OnHide", () => {
            for (const fade of [fades.fadeIn, fades.fadeOut, fades.breathe]) fade?.Stop();
            if (fades.breathe !== undefined) this.pulses.delete(fades.breathe);
        });
        return { frame, texture: parts[0], parts, animation, scale: BORDER_SCALE, ...fades };
    }

    private createOverlay(button: ActionButton, animation: GlowAnimation): Overlay {
        if (!this.isBesideButton(button)) return this.createOverlayIn(button, button, animation);
        this.trackButton(button);
        const overlay = this.createOverlayIn(UIParent, button, animation);
        overlay.isBeside = true;
        overlay.frame.SetFrameStrata(button.GetFrameStrata());
        return overlay;
    }

    /** The glow of the button, made in `parent`: the button itself, or the screen for a button of the gamepad bars. */
    private createOverlayIn(parent: Frame, button: ActionButton, animation: GlowAnimation): Overlay {
        const level = button.GetFrameLevel() + 6;
        if (this.isRoundButton(button)) return this.createRing(parent, button, level, animation);
        if (animation === "clean") return { ...createLineGlow(parent, button, level), animation };
        // Clean, standing still (breathing, or none): Blizzard's soft square frame around the button
        if (animation === "breathingClean" || animation === "noneClean") {
            const border = createSoftFrame(parent, button, level);
            return this.setUpBorder(border.frame, border.inner, border.parts, animation);
        }
        // Blizzard's own spell-alert glow, but our own instance, never the one the action bar manager
        // drives, so real procs are unaffected
        const [didSucceed, created] = tryCall(() => CreateFrame("Frame", undefined, parent, "ActionButtonSpellAlertTemplate"));
        const alert = didSucceed ? (created as SpellAlertFrame) : undefined;
        if (alert?.ProcStartAnim && alert.ProcLoop) {
            alert.SetFrameStrata("MEDIUM");
            alert.SetFrameLevel(level);
            alert.SetPoint("CENTER", button, "CENTER", 0, 0);
            const fades = { animation, ...createStillFades(alert, alert.ProcLoopFlipbook) };
            alert.SetScript("OnShow", () => this.startAlert(alert, fades));
            alert.SetScript("OnHide", () => {
                alert.ProcStartAnim!.Stop();
                alert.ProcLoop!.Stop();
                for (const fade of [fades.fadeIn, fades.fadeOut, fades.breathe]) fade?.Stop();
                if (fades.breathe !== undefined) this.pulses.delete(fades.breathe);
            });
            alert.ProcAltGlow?.Hide();
            alert.Hide();
            return { frame: alert, alert, ...fades };
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
        return { frame, texture, animation };
    }

    /** A round button: one another addon registered as round, or a round one of the gamepad bars (Forever). */
    private isRoundButton(button: ActionButton): boolean {
        return this.actionBars.getButtonShape(button) === "Circle";
    }

    /**
     * The client's round halo and highlight around the button (the art of the gamepad bars), breathing or still; a circling
     * glow does what the round buttons' animation says, asked as it shows.
     */
    private createRing(parent: Frame, button: ActionButton, level: number, animation: GlowAnimation): Overlay {
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
                // Neither way of circling can run around a round button: there it does what the round buttons' animation says
                const isCircling = animation === "circling" || animation === "clean";
                if (!isBreathing(isCircling ? this.roundAnimation : animation)) return;
                this.pulses.add(pulse);
                this.syncPulses();
            });
            frame.SetScript("OnHide", () => {
                pulse.Stop();
                this.pulses.delete(pulse);
            });
        }
        frame.Hide();
        return { frame, texture, halo, isRing: true, animation };
    }

    /** Every breathing glow that shows breathes from the start again, in step with the one that just lit. */
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
