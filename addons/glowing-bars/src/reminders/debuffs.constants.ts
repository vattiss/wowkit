// The debuffs a class has on the Debuffs tab from the start (the player adds more by ID), and how long the common ones
// last until one is seen on a target and its own length is learned (by its name, so every rank counts). Their lengths in the
// Classic game: each rank lasts the same.
import { Hunter, Priest, Warlock } from "@wowkit/wow-data";
import type { AddedSpellsService } from "../glows/added-spells.service";

/** A debuff's spell (any rank: its name is what counts) and how long it lasts, in seconds. */
export const DEBUFF_SECONDS: [spellId: number, seconds: number][] = [
    [Hunter.SerpentSting, 15],
    [Hunter.HuntersMark, 120],
    [Priest.ShadowWordPain, 18],
    // Corruption's first ranks are shorter (12 and 15 seconds): its own length is learned once the game shows its aura
    [Warlock.Corruption, 18],
    [Warlock.CurseOfAgony, 24],
];

/** The debuffs of each class on the Debuffs tab without being added: the first damage over time of a class, to try. */
export const CLASS_DEBUFFS: { [classToken: string]: number[] | undefined } = {
    HUNTER: [Hunter.SerpentSting, Hunter.HuntersMark],
    PRIEST: [Priest.ShadowWordPain],
    WARLOCK: [Warlock.Corruption, Warlock.CurseOfAgony],
};

/** The class's own debuffs (none for a class without). */
export function listClassDebuffs(classToken: string | undefined): number[] {
    return CLASS_DEBUFFS[classToken ?? ""] ?? [];
}

/** A debuff to remind of: the ID its row is switched by (a listed one's own), and the spell (its ID fixed by the player, if so). */
export interface DebuffEntry {
    switchId: number;
    spellId: number;
}

/** The debuffs to remind of: the class's, then the player's added ones. */
export function listDebuffs(classToken: string | undefined, addedSpells: AddedSpellsService): DebuffEntry[] {
    const listed = listClassDebuffs(classToken).map((id) => ({ switchId: id, spellId: addedSpells.getEffectiveId(id) }));
    const added = addedSpells.listAdded("missingDebuff").map((id) => ({ switchId: id, spellId: id }));
    return [...listed, ...added];
}

/** The key of a debuff's switch in the per-spell switches: its own, as its spell may have a proc row too ("debuff:589"). */
export function buildDebuffSwitchKey(switchId: number): string {
    return string.format("debuff:%d", switchId);
}
