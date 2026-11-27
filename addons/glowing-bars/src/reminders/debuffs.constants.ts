// How long the common debuffs of the players last, until one is seen on a target and its own length is learned (by its
// name, so every rank counts). Their lengths in the Classic game: each rank lasts the same.
import { Hunter } from "@wowkit/wow-data";

/** A debuff's spell (any rank: its name is what counts) and how long it lasts, in seconds. */
export const DEBUFF_SECONDS: [spellId: number, seconds: number][] = [
    [Hunter.SerpentSting, 15],
    [Hunter.HuntersMark, 120],
];
