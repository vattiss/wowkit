// Game events: which event makes the addon do what. It reads like a list; the work is in the
// functions it calls (refresh.ts says when to look again, tick.ts what a look does).
import { barsMapped, mapBars } from "../wow/action-bars";
import { noteFormChange, noteSelfBuff, wipeAuraScan } from "../wow/auras";
import { onEvent, onPlayerEvent, onPlayerSpellCast, type PlayerSpellCast } from "../wow/events";
import { say } from "../wow/notice";
import { getEquippedItemId, isInCombat } from "../wow/player";
import { invalidateSpells, noteLearnedSpell, rebuildSpellBook, spellBookIndexed } from "../wow/spells";
import { clearWeaponTooltipCache } from "../wow/weapon-enchants";
import { MAIN_HAND_SLOT, OFF_HAND_SLOT } from "../constants";
import { getText } from "../locale";
import { refreshPartyBuffs } from "../reminders/party-buffs";
import { weaponReminder } from "../reminders/weapon-reminder";
import { loadSettings, settingChanged, settings } from "../settings";
import { createSignal } from "../util/signal";
import { contains } from "../util/text";
import { requestTick, requestTickWithFreshAuras, scheduleBarRemap, scheduleSpellRefresh } from "./refresh";
import { markGlowsStale, redrawGlowsAfterSettingChange } from "./show-reminders";
import { startTicking, stopTicking, tick } from "./tick";
import { checkReagentsOnArrival } from "./town-visit";

/** Fired once, at the first login of the session (after the settings are loaded). */
export const booted = createSignal();

let addonName = "";
let hasBooted = false;
let mainHandItem: number | undefined;
let offHandItem: number | undefined;

function onLogin(shouldGreet: boolean): void {
    if (!hasBooted) {
        hasBooted = true;
        invalidateSpells(true);
        rebuildSpellBook(false);
        mapBars(true);
        startTicking();
        booted.emit();
    }
    mainHandItem = getEquippedItemId(MAIN_HAND_SLOT);
    offHandItem = getEquippedItemId(OFF_HAND_SLOT);
    if (shouldGreet) say(getText("INIT"));
    tick();
    checkReagentsOnArrival();
}

/** A different weapon makes what the weapon reminder remembered about the old one wrong. */
function onEquipmentChanged(slot: number): void {
    if (slot === MAIN_HAND_SLOT || slot === OFF_HAND_SLOT) {
        const itemId = getEquippedItemId(slot);
        const previousItemId = slot === MAIN_HAND_SLOT ? mainHandItem : offHandItem;
        if (itemId !== previousItemId) {
            if (slot === MAIN_HAND_SLOT) mainHandItem = itemId;
            else offHandItem = itemId;
            weaponReminder.clearMemory();
        }
        clearWeaponTooltipCache();
    }
    requestTick();
}

/**
 * A cast of a buff is remembered (in combat the client hides the aura), and a weapon buff cast
 * starts the grace time of the weapon reminder.
 */
function onSpellCast(cast: PlayerSpellCast): void {
    noteSelfBuff(cast.spellId);
    weaponReminder.noteCast(cast.spellId, cast.spellName);
    wipeAuraScan("player");
    requestTick();
}

/** The client's popup does not say which protected function was called; the event does. */
function noteBlockedAction(addon: string, action: string): void {
    const text = `${tostring(addon)} | ${tostring(action)}`;
    if (!contains(text, addonName)) return;
    const described = `${text} | ${isInCombat() ? "combat" : "no combat"}`;
    settings.blockedAction = described;
    say(string.format(getText("BLOCKED_ACTION"), described));
}

/** Wires every event. `name` is this addon's folder name. */
export function startGameEvents(name: string): void {
    addonName = name;

    // What the addon itself announces
    spellBookIndexed.listen(() => {
        markGlowsStale();
        tick();
    });
    barsMapped.listen(markGlowsStale);
    settingChanged.listen((key) => {
        redrawGlowsAfterSettingChange(key);
        tick();
    });

    // Login and logout
    const stopLoading = onEvent("ADDON_LOADED", (loaded) => {
        if (loaded !== addonName) return;
        stopLoading();
        loadSettings();
    });
    onEvent("PLAYER_LOGIN", () => onLogin(true));
    onEvent("PLAYER_ENTERING_WORLD", () => onLogin(false));
    onEvent("PLAYER_LOGOUT", stopTicking);

    // Spells learned: do NOT listen to SPELLS_CHANGED. Forever fires it in storms on quest turn-in
    // and level-up, and rebuilding on it froze the client
    onEvent("LEARNED_SPELL_IN_SKILL_LINE", (spellId) => {
        noteLearnedSpell(spellId);
        scheduleSpellRefresh();
    });
    onEvent("PLAYER_TALENT_UPDATE", scheduleSpellRefresh);
    onEvent("PLAYER_LEVEL_UP", scheduleSpellRefresh);

    // The action bars changed
    onEvent("SPELL_PUSHED_TO_ACTIONBAR", scheduleBarRemap);
    onEvent("ACTIONBAR_SLOT_CHANGED", scheduleBarRemap);
    onEvent("ACTIONBAR_PAGE_CHANGED", scheduleBarRemap);
    onEvent("UPDATE_SHAPESHIFT_FORM", () => {
        noteFormChange();
        scheduleBarRemap();
    });

    // The player's situation changed
    onEvent("PLAYER_UPDATE_RESTING", () => {
        requestTickWithFreshAuras();
        checkReagentsOnArrival();
    });
    onEvent("GROUP_ROSTER_UPDATE", () => {
        refreshPartyBuffs();
        requestTick();
    });
    for (const event of [
        "ZONE_CHANGED_NEW_AREA",
        "PLAYER_ALIVE",
        "PLAYER_UNGHOST",
        "PLAYER_MOUNT_DISPLAY_CHANGED",
        "PLAYER_DEAD",
        "PLAYER_REGEN_ENABLED",
    ] as const) {
        onEvent(event, requestTickWithFreshAuras);
    }

    // Auras, items and casts. No forced tick on auras: aura storms would feel like input lag; the
    // regular tick reads them again
    onPlayerEvent("UNIT_AURA", (unit) => wipeAuraScan(unit));
    onPlayerEvent("UNIT_INVENTORY_CHANGED", () => {
        clearWeaponTooltipCache();
        requestTick();
    });
    onPlayerSpellCast(onSpellCast);
    onEvent("PLAYER_EQUIPMENT_CHANGED", onEquipmentChanged);
    onEvent("WEAPON_ENCHANT_CHANGED", () => {
        clearWeaponTooltipCache();
        weaponReminder.noteEnchantChanged();
        requestTick();
    });

    // The game blocked something this addon did
    onEvent("ADDON_ACTION_BLOCKED", noteBlockedAction);
    onEvent("ADDON_ACTION_FORBIDDEN", noteBlockedAction);
}
