// Stage 1 of a tick: find everything the player should be reminded of right now.
//
// It reads the game and the settings and returns a plain description. It shows nothing and does
// not remember the previous tick; that is show-reminders.ts.
import { findOutdatedRanks, isOnBars, type OutdatedRank } from "../wow/action-bars";
import { shouldStayIdle } from "../wow/player";
import { isCastable } from "../wow/spells";
import { findMissingBuffs, rememberSelfBuffs } from "../reminders/buff-reminder";
import { findPartyBuffSuggestions, type PartySuggestion } from "../reminders/party-buffs";
import { weaponReminder } from "../reminders/weapon-reminder";
import { settings } from "../settings";

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

function createEmptyReminders(): Reminders {
    return { buffsToCast: [], weaponSpell: undefined, buffsNotOnBars: [], partySuggestions: [], outdatedRanks: [] };
}

/** The player's own missing buffs, then the party buffs that can be cast from the bars. */
function findBuffsToCast(ownBuffs: number[], partySuggestions: PartySuggestion[]): number[] {
    const buffs = [...ownBuffs];
    for (const suggestion of partySuggestions) {
        if (!buffs.includes(suggestion.spellId) && isOnBars(suggestion.spellId) && isCastable(suggestion.spellId) !== false) {
            buffs.push(suggestion.spellId);
        }
    }
    return buffs;
}

export function findReminders(): Reminders {
    // Looks at the buffs out of combat even when nothing is due, so the aura memory knows them
    rememberSelfBuffs();

    // Nothing while dead, mounted, eating or resting in town, or when the player muted the addon
    const isIdle = shouldStayIdle(settings.hideResting) || settings.isMuted;
    if (isIdle) return createEmptyReminders();

    const missingBuffs = settings.showBuff ? findMissingBuffs() : { glow: [], notOnBars: [] };
    const partySuggestions = settings.showBuff ? findPartyBuffSuggestions() : [];
    const weaponCheck = settings.showWeapon ? weaponReminder.check() : undefined;
    return {
        buffsToCast: findBuffsToCast(missingBuffs.glow, partySuggestions),
        weaponSpell: weaponCheck?.isNeeded ? weaponCheck.spellId : undefined,
        buffsNotOnBars: settings.showBarNotice ? missingBuffs.notOnBars : [],
        partySuggestions,
        outdatedRanks: settings.showRankNotice ? findOutdatedRanks() : [],
    };
}
