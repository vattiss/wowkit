// Values of the game that more than one service needs.

/** Inventory slots of the weapons. */
export const MAIN_HAND_SLOT = 16;
export const OFF_HAND_SLOT = 17;
export const RANGED_SLOT = 18;

/** "Seconds left" of something without an end, or whose end the client did not tell. */
export const NO_EXPIRY = 9999;

/**
 * A real, known number of seconds left (not NO_EXPIRY). Anything from 9000 seconds up counts as
 * "no end", leaving a margin below the NO_EXPIRY marker.
 */
export function hasKnownExpiry(remain: number): boolean {
    return remain > 0 && remain < 9000;
}
