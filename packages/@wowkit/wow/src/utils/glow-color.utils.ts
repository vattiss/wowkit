// The color of a glow: its art in gray, tinted with the reminder's color. The original classic glow keeps the game's own
// gold instead: its art as it is, gold at the edges and near white inside, which no single tint gives.
import { isClassic, isOriginal } from "./glow-animation.utils";
import { GLOW_ALPHA } from "./glow-look.constants";
import type { Overlay } from "./glow-overlay.interface";

/** As GlowService's Rgb: kept here, as the service imports this file. */
type Rgb = [r: number, g: number, b: number];

export function applyGlowColor(entry: Overlay, [r, g, b]: Rgb): void {
    if (entry.alert) return applyAlertColor(entry, [r, g, b]);
    // An original look keeps the art's own colors, also on a round button; any other is gray, tinted
    const isOwnColor = isOriginal(entry.animation);
    const isGray = !isOwnColor && (isClassic(entry.animation) || entry.isRing === true);
    const [tintR, tintG, tintB] = isOwnColor ? [1, 1, 1] : [r, g, b];
    const parts = [...(entry.parts ?? [entry.texture!])];
    // The classic glow's ants are its halo too: each texture once
    if (entry.halo !== undefined && !parts.includes(entry.halo)) parts.push(entry.halo);
    for (const part of parts) {
        if (isOwnColor || isGray) part.SetDesaturated(isGray);
        part.SetVertexColor(tintR, tintG, tintB, GLOW_ALPHA);
    }
}

/** Blizzard's spell-alert glow: desaturated, so the reminder color tints it instead of mixing with gold. */
function applyAlertColor(entry: Overlay, [r, g, b]: Rgb): void {
    for (const texture of [entry.alert!.ProcStartFlipbook, entry.alert!.ProcLoopFlipbook]) {
        texture?.SetDesaturated(true);
        texture?.SetVertexColor(r, g, b);
    }
    entry.frame.SetAlpha(GLOW_ALPHA);
}
