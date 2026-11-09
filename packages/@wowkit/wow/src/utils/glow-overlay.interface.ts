// One glow on one button: its frames, and how it moves.
import type { GlowAnimation } from "./glow-animation.utils";

export interface Overlay {
    frame: Frame;
    alert?: SpellAlertFrame;
    texture?: Texture;
    /** The strips of the drawn border of a still glow, tinted together. */
    parts?: Texture[];
    /** Its size against the button's, where it is not the glow's own (the drawn border). */
    scale?: number;
    /** The fading in and out of a still glow, and the breathing of a breathing one. */
    fadeIn?: AnimationGroup;
    fadeOut?: AnimationGroup;
    breathe?: AnimationGroup;
    /** The glow is lit (it shows while its button does). */
    isWanted?: boolean;
    /** A frame beside the button, not its child (a button of the gamepad bars). */
    isBeside?: boolean;
    /** The ring of a round button; its halo is drawn around it. */
    isRing?: boolean;
    halo?: Texture;
    /** How it moves: the animation of its glow (on a round button, circling is the round buttons' animation). */
    animation: GlowAnimation;
}
