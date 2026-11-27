import type { OlderRankBuff } from "../character/buff-state.service";
import type { LowReagent } from "../reagents/reagent.interface";
import type { OutdatedRank } from "../reminders/outdated-ranks.service";
import type { CoveredWeaponButton, PartySuggestion, LowStock } from "../reminders/reminders.interface";

/** Everything the player should be reminded of right now: what stage 1 of a tick finds. */
export interface Reminders {
    /** Buffs to cast now that sit on an action button: their buttons glow (the player's, then the party's). */
    buffsToCast: number[];
    /** The weapon buff that needs attention: its button glows. */
    weaponSpell?: number;
    /** The weapon the weapon buff is for. */
    weaponHandSlot?: number;
    /** The buttons of added weapon buffs whose weapon has a temporary enchant on it: dark for that weapon buff alone. */
    coveredWeaponButtons: CoveredWeaponButton[];
    /** Weapon buffs the player added, when a weapon of theirs has no temporary enchant: their buttons glow. */
    addedWeaponSpells: number[];
    /** A paladin with no seal up: the seal to put on. */
    seals: number[];
    /** A miner or a herbalist with no tracking on: the gathering trackings to put on. */
    trackings: number[];
    /** The debuffs the player added that the enemy targeted lacks (or that run out): the spells to cast. */
    debuffs: number[];
    /** A shaman's totems that are gone: the last dropped in each element whose totem went. */
    totemsGone: number[];
    /** Missing buffs the player has learned but put on no action bar. */
    buffsNotOnBars: number[];
    /** Party members missing one of the player's buffs. */
    partySuggestions: PartySuggestion[];
    /** Spells on the bars at a lower rank than the highest learned one. */
    outdatedRanks: OutdatedRank[];
    /** Buffs on the player at an older rank than the player knows: a line in the chat, once each. Undefined: not looked at. */
    olderRankBuffs: OlderRankBuff[] | undefined;
    /** The items the player watches that run low: they glow if on a button, and say so on a bar or not. */
    lowStock: LowStock[];
    /** The reagents running low, on a bar or not: the message names them. */
    lowReagents: LowReagent[];
    /** Group buffs on a button whose reagent runs low: their buttons glow quietly. */
    reagentSpells: number[];
    /** In a town or an inn: only there a reminder whose When is "alert in town" says so, and repeats. */
    isInTown?: boolean;
    /** In a raid, not a party: the message of the members missing a buff follows the raid's switch. */
    isInRaid?: boolean;
    /** Important cooldowns that are ready and on a button: their buttons glow. */
    readyCooldowns: number[];
    /** The same, due but on no button now (a page of a bar not shown): their glow time waits for them. */
    pagedAwayCooldowns: number[];
    /** The cooldowns of between fights that are ready and on a button, and the ones due on no button now. */
    utilityCooldowns: number[];
    pagedAwayUtilityCooldowns: number[];
    /** The ready cooldowns of each type never seen running since the login: they were ready before it, and do not glow for it. */
    readyBeforeCooldowns: number[];
    readyBeforeUtilityCooldowns: number[];
    /** Spells the game says are usable now (and ready): their buttons glow. */
    procs: number[];
}
