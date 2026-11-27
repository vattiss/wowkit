// What a glow on action buttons offers its owner (see GlowService.createButtonGlow).
import type { HiddenAlpha } from "../value-curves.service";

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
    /** Each frame of the glow that is lit, one on each button: what a mask goes on (see glow-gate.utils). */
    applyToFrames: (this: void, visit: (this: void, frame: Frame) => void) => void;
}
