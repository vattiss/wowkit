// How a glow moves.

/**
 * How a glow moves, in two looks: ants (Blizzard's proc glow) or clean (the clean line running around, and Blizzard's soft
 * square frame standing still). Circling runs around the button; breathing stands still, slowly fading out and in; none
 * stands still, fading in as it lights and out as it goes. The ants that stand still are Blizzard's glow stopped on a picture.
 */
export type GlowAnimation = "circling" | "clean" | "breathing" | "breathingClean" | "none" | "noneClean";

/** Does the glow breathe (in either look)? */
export function isBreathing(animation: GlowAnimation): boolean {
    return animation === "breathing" || animation === "breathingClean";
}

/** Does the glow stand still, only fading in and out (in either look)? */
export function isStill(animation: GlowAnimation): boolean {
    return animation === "none" || animation === "noneClean";
}
