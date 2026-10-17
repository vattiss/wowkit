import type { PartySuggestion } from "../reminders/reminders.interface";
import type { OutdatedRank } from "@forever/wow";

/** Everything the player should be reminded of right now: what stage 1 of a tick finds. */
export interface Reminders {
    /** Buffs to cast now that sit on an action button: their buttons glow (the player's, then the party's). */
    buffsToCast: number[];
    /** The weapon buff that needs attention: its button glows. */
    weaponSpell?: number;
    /** Missing buffs the player has learned but put on no action bar. */
    buffsNotOnBars: number[];
    /** Party members missing one of the player's buffs. */
    partySuggestions: PartySuggestion[];
    /** Spells on the bars at a lower rank than the highest the player knows. */
    outdatedRanks: OutdatedRank[];
}
