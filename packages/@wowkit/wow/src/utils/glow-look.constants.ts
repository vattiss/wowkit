// What the glows are made of: the client's art, and their sizes.

/** Fallback art if the spell-alert glow template is missing; built-in client art only. */
export const GLOW_FALLBACK = "Interface\\Cooldown\\star4";
export const GLOW_SCALE = 1.45;
export const GLOW_ALPHA = 0.95;
/**
 * The glow of a round gamepad button, in two layers of the client's own gamepad art: a soft round halo well around the
 * button (the glow it flashes when a cast completes), and the ring it highlights the button with.
 */
export const RING_ATLAS = "gamepad-actionbar-circleslot-border-hover";
export const RING_SCALE = 1.2;
export const HALO_ATLAS = "gamepad-hud-actionbar-casting-complete-glow";
/** The halo's size, against the ring's. */
export const HALO_SCALE = 1.35;
/** A breathing glow fades between full and this opacity, half a second each way. */
export const RING_PULSE_ALPHA = 0.45;
export const RING_PULSE_SECONDS = 0.5;
/**
 * The loop of the alert's glow, a flipbook. A glow that does not circle shows one picture of it still: the loop runs a
 * frame, so the client cuts the picture out, and is stopped, its picture kept: while it runs, even paused, it holds the
 * picture's opacity, so a fade could not change it.
 */
export const LOOP_ATLAS = "UI-HUD-ActionBar-Proc-Loop-Flipbook";
