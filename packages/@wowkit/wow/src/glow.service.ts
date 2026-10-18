// A glow on action buttons: Blizzard's spell-alert ("proc") animation, tinted with a color.

import type { ActionBarsService } from "./action-bars.service";
import { tryCall } from "./utils/protected-call.utils";
import type { HiddenAlpha } from "./value-curves.service";

/** A color as red, green and blue between 0 and 1. */
export type Rgb = [r: number, g: number, b: number];

/** Fallback art if the spell-alert glow template is missing; built-in client art only. */
const GLOW_FALLBACK = "Interface\\Cooldown\\star4";
const GLOW_SCALE = 1.45;
const GLOW_ALPHA = 0.95;

interface Overlay {
    frame: Frame;
    alert?: SpellAlertFrame;
    texture?: Texture;
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

    constructor(private readonly actionBars: ActionBarsService) {}

    /** One glow on the buttons of some spells; each kind (the buff, the weapon buff) keeps its own overlays. */
    createButtonGlow(kind: string): ButtonGlow {
        const glowing = new LuaSet<ActionButton>();
        let last: string | undefined;
        const clearGlow = () => {
            for (const button of glowing) {
                this.overlays.get(button)?.get(kind)?.frame.Hide();
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
                if (key === last && !glowing.isEmpty()) return;
                const buttons = spellIds.flatMap((spellId) => this.actionBars.findButtonsOf(spellId));
                clearGlow();
                last = key;
                for (const button of buttons) {
                    if (!glowing.has(button)) {
                        this.getOverlay(button, kind, color).Show();
                        glowing.add(button);
                    }
                }
            },
        };
    }

    private getOverlay(button: ActionButton, kind: string, [r, g, b]: Rgb): Frame {
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
        const width = button.GetWidth();
        const height = button.GetHeight();
        entry.frame.SetSize((width < 8 ? 36 : width) * GLOW_SCALE, (height < 8 ? 36 : height) * GLOW_SCALE);
        if (entry.alert) {
            // Desaturated, so the reminder color tints the glow instead of mixing with gold
            for (const texture of [entry.alert.ProcStartFlipbook, entry.alert.ProcLoopFlipbook]) {
                texture?.SetDesaturated(true);
                texture?.SetVertexColor(r, g, b);
            }
            entry.frame.SetAlpha(GLOW_ALPHA);
        } else {
            entry.texture!.SetVertexColor(r, g, b, GLOW_ALPHA);
        }
        return entry.frame;
    }

    private createOverlay(button: ActionButton): Overlay {
        const level = button.GetFrameLevel() + 6;
        // Blizzard's own spell-alert glow, but our own instance, never the one the action bar manager
        // drives, so real procs are unaffected
        const [didSucceed, created] = tryCall(() => CreateFrame("Frame", undefined, button, "ActionButtonSpellAlertTemplate"));
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
        const frame = CreateFrame("Frame", undefined, button);
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
}
