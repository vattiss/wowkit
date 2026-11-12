// How a glow moves.

/**
 * How a glow moves, in three looks: ants (Blizzard's proc glow), clean (the clean line running around, and Blizzard's soft
 * square frame standing still) or classic (Blizzard's older gold proc border, its ants marching when it circles; the
 * original one in the game's own gold, not tinted). Circling runs around the button; breathing stands still, slowly
 * fading out and in; none stands still, fading in as it lights and out as it goes. The ants that stand still are Blizzard's
 * glow stopped on a picture.
 */
export type GlowAnimation =
    | "circling"
    | "clean"
    | "circlingClassic"
    | "circlingOriginal"
    | "breathing"
    | "breathingClean"
    | "breathingClassic"
    | "breathingOriginal"
    | "none"
    | "noneClean"
    | "noneClassic"
    | "noneOriginal";

/** Does the glow run around the button (in any look)? */
export function isCircling(animation: GlowAnimation): boolean {
    return animation === "circling" || animation === "clean" || animation === "circlingClassic" || animation === "circlingOriginal";
}

/** Does the glow breathe (in any look)? */
export function isBreathing(animation: GlowAnimation): boolean {
    return (
        animation === "breathing" || animation === "breathingClean" || animation === "breathingClassic" || animation === "breathingOriginal"
    );
}

/** Does the glow stand still, only fading in and out (in any look)? */
export function isStill(animation: GlowAnimation): boolean {
    return animation === "none" || animation === "noneClean" || animation === "noneClassic" || animation === "noneOriginal";
}

/** Is it the classic look, tinted or in the game's own gold? */
export function isClassic(animation: GlowAnimation): boolean {
    return animation === "circlingClassic" || animation === "breathingClassic" || animation === "noneClassic" || isOriginal(animation);
}

/** Is it the classic look in the game's own gold, not tinted? */
export function isOriginal(animation: GlowAnimation): boolean {
    return animation === "circlingOriginal" || animation === "breathingOriginal" || animation === "noneOriginal";
}
