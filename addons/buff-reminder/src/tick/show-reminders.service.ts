// Stage 2 of a tick: show the reminders. A sound when something new appears, the notice text, and
// the glows on the action buttons. It remembers what it showed last time, so only a change is
// shown again.

import type { MessagesService } from "@wowkit/ui";
import { getGlowColor } from "../settings/settings.colors";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { GlowService, ReminderGlow } from "@wowkit/wow";
import type { NoticesService } from "./notices.service";
import type { Reminders } from "./tick.interface";

export class ShowRemindersService {
    private readonly buffGlow: ReminderGlow;
    private readonly weaponGlow: ReminderGlow;
    /** The buffs and the weapon spell of the previous tick, to tell what is new. */
    private previousBuffs: number[] = [];
    private previousWeaponSpell: number | undefined;
    /** The glow of the previous tick as "buffs:weapon"; undefined makes the next tick set the glows again. */
    private shownGlowKey: string | undefined;

    constructor(
        glow: GlowService,
        private readonly messages: MessagesService,
        private readonly settings: AddonSettingsService,
        private readonly notices: NoticesService,
    ) {
        this.buffGlow = glow.createReminderGlow("buff");
        this.weaponGlow = glow.createReminderGlow("weapon");
    }

    showReminders(reminders: Reminders): void {
        this.playSoundsForNewReminders(reminders);
        this.notices.showNoticeIfNew(reminders);
        this.updateGlows(reminders);
    }

    /** The buttons or the spells changed under the glows: set them again on the next tick. */
    markGlowsStale(): void {
        this.shownGlowKey = undefined;
    }

    /** A setting changed: glows that are now off go out at once, and a new color lights them again. */
    redrawGlowsAfterSettingChange(key: string): void {
        if (key === "colors" || !this.settings.get("showBuff")) this.buffGlow.clear();
        if (key === "colors" || !this.settings.get("showWeapon")) this.weaponGlow.clear();
        this.markGlowsStale();
    }

    /** A sound when a buff or the weapon buff starts to glow, not each time another one goes out. */
    private playSoundsForNewReminders(reminders: Reminders): void {
        if (reminders.buffsToCast.some((id) => !this.previousBuffs.includes(id))) {
            this.messages.playAlertSound(this.settings.get("soundBuff"));
        }
        this.previousBuffs = reminders.buffsToCast;
        if (reminders.weaponSpell !== undefined && reminders.weaponSpell !== this.previousWeaponSpell) {
            this.messages.playAlertSound(this.settings.get("soundWeapon"));
        }
        this.previousWeaponSpell = reminders.weaponSpell;
    }

    private updateGlows(reminders: Reminders): void {
        const glowKey = `${reminders.buffsToCast.join(",")}:${reminders.weaponSpell ?? 0}`;
        if (glowKey === this.shownGlowKey) return;
        this.shownGlowKey = glowKey;
        this.buffGlow.show(reminders.buffsToCast, getGlowColor(this.settings, "buff"));
        this.weaponGlow.show(reminders.weaponSpell !== undefined ? [reminders.weaponSpell] : [], getGlowColor(this.settings, "weapon"));
    }
}
