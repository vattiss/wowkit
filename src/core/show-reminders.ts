// Stage 2 of a tick: show the reminders. A sound when something new appears, the notice text, and
// the glows on the action buttons. It remembers what it showed last time, so only a change is
// shown again.
import { createReminderGlow } from "../wow/glow";
import { playAlertSound } from "../wow/notice";
import { getColor, settings } from "../settings";
import type { Reminders } from "./find-reminders";
import { showNoticeIfNew } from "./notices";

const buffGlow = createReminderGlow("buff");
const weaponGlow = createReminderGlow("weapon");

/** The buffs and the weapon spell of the previous tick, to tell what is new. */
let previousBuffs: number[] = [];
let previousWeaponSpell: number | undefined;
/** The glow of the previous tick as "buffs:weapon"; undefined makes the next tick set the glows again. */
let shownGlowKey: string | undefined;

export function showReminders(reminders: Reminders): void {
    playSoundsForNewReminders(reminders);
    showNoticeIfNew(reminders);
    updateGlows(reminders);
}

/** A sound when a buff or the weapon buff starts to glow, not each time another one goes out. */
function playSoundsForNewReminders(reminders: Reminders): void {
    if (reminders.buffsToCast.some((id) => !previousBuffs.includes(id))) playAlertSound(settings.soundBuff);
    previousBuffs = reminders.buffsToCast;
    if (reminders.weaponSpell !== undefined && reminders.weaponSpell !== previousWeaponSpell) playAlertSound(settings.soundWeapon);
    previousWeaponSpell = reminders.weaponSpell;
}

function updateGlows(reminders: Reminders): void {
    const glowKey = `${reminders.buffsToCast.join(",")}:${reminders.weaponSpell ?? 0}`;
    if (glowKey === shownGlowKey) return;
    shownGlowKey = glowKey;
    buffGlow.show(reminders.buffsToCast, getColor("buff"));
    weaponGlow.show(reminders.weaponSpell !== undefined ? [reminders.weaponSpell] : [], getColor("weapon"));
}

/** The buttons or the spells changed under the glows: set them again on the next tick. */
export function markGlowsStale(): void {
    shownGlowKey = undefined;
}

/** A setting changed: glows that are now off go out at once, and a new color lights them again. */
export function redrawGlowsAfterSettingChange(key: string): void {
    if (key === "colors" || !settings.showBuff) buffGlow.clear();
    if (key === "colors" || !settings.showWeapon) weaponGlow.clear();
    markGlowsStale();
}
