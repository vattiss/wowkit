// Stage 1 of a tick: find everything the player should be reminded of right now.
//
// It reads the game and the settings and returns a plain description. It shows nothing and does
// not remember the previous tick; that is show-reminders.service.ts.

import type { BuffReminderService } from "../reminders/buff-reminder.service";
import type { PartyBuffsService } from "../reminders/party-buffs.service";
import type { MissingBuffs, PartySuggestion } from "../reminders/reminders.interface";
import type { WeaponReminderService } from "../reminders/weapon/weapon-reminder.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ActionBarsService, PlayerService, SpellsService } from "@wowkit/wow";
import type { Reminders } from "./tick.interface";

function createEmptyReminders(): Reminders {
    return { buffsToCast: [], weaponSpell: undefined, buffsNotOnBars: [], partySuggestions: [] };
}

export class FindRemindersService {
    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly buffReminder: BuffReminderService,
        private readonly partyBuffs: PartyBuffsService,
        private readonly weaponReminder: WeaponReminderService,
        private readonly settings: AddonSettingsService,
    ) {}

    findReminders(): Reminders {
        // Looks at the buffs out of combat even when nothing is due, so the aura memory knows them
        this.buffReminder.rememberSelfBuffs();

        // Nothing while dead, mounted, eating or resting in town, or when the player muted the addon
        const isIdle = this.player.shouldStayIdle(this.settings.get("hideResting")) || this.settings.get("isMuted");
        if (isIdle) return createEmptyReminders();

        const showBuff = this.settings.get("showBuff");
        const missingBuffs: MissingBuffs = showBuff ? this.buffReminder.findMissingBuffs() : { glow: [], notOnBars: [] };
        const partySuggestions = showBuff ? this.partyBuffs.findPartyBuffSuggestions() : [];
        const weaponCheck = this.settings.get("showWeapon") ? this.weaponReminder.check() : undefined;
        return {
            buffsToCast: this.findBuffsToCast(missingBuffs.glow, partySuggestions),
            weaponSpell: weaponCheck?.isNeeded ? weaponCheck.spellId : undefined,
            buffsNotOnBars: this.settings.get("showBarNotice") ? missingBuffs.notOnBars : [],
            partySuggestions,
        };
    }

    /** The player's own missing buffs, then the party buffs that can be cast from the bars. */
    private findBuffsToCast(ownBuffs: number[], partySuggestions: PartySuggestion[]): number[] {
        const buffs = [...ownBuffs];
        for (const suggestion of partySuggestions) {
            if (
                !buffs.includes(suggestion.spellId) &&
                this.actionBars.isOnBars(suggestion.spellId) &&
                this.spells.isCastable(suggestion.spellId) !== false
            ) {
                buffs.push(suggestion.spellId);
            }
        }
        return buffs;
    }
}
