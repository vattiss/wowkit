// The reminder loop: a tick every 0.2 seconds decides what glows and what the notice says, and
// game events keep the caches (spells, auras, bars, weapon) fresh.
import { barsMapped, isOnBars, mapBars, findOutdatedRanks } from "./action-bars";
import { noteFormChange, noteSelfBuff, wipeAuraScan, wipeAuraScans } from "./api/auras";
import { invalidateSpells, noteLearnedSpell, rebuildSpellBook, resolveFromName, spellBookIndexed, getSpellName, isCastable } from "./api/spells";
import { isInCombat, isResting, shouldStayIdle } from "./api/unit";
import { clearWeaponTooltipCache } from "./api/weapon";
import { findMissingBuffs, rememberSelfBuffs } from "./buff-reminder";
import { MAIN_HAND_SLOT, OFF_HAND_SLOT } from "./constants";
import { onEvent, onPlayerEvent } from "./events";
import { buffGlow, weaponGlow } from "./glow";
import { say, getText } from "./locale";
import { playAlertSound, showNotice } from "./notice";
import { findPartyBuffSuggestions, refreshPartyBuffs, type PartySuggestion } from "./party-buffs";
import { findLowReagents } from "./reagents";
import { loadSettings, settingChanged, settings } from "./settings";
import { attempt, attemptMulti, isReadable } from "./util/safe";
import { createSignal } from "./util/signal";
import { contains } from "./util/text";
import { weaponReminder } from "./weapon-reminder";

const TICK_SECONDS = 0.2;
/** A notice with the same content is shown again only after this long. */
const NOTICE_REPEAT = 30;
/** Bars are mapped again this long after they change; notices wait for that. */
const BAR_SETTLE = 0.5;
const NOTICE_AFTER_BAR_CHANGE = 1.5;
/** Spell caches are flushed this long after a learn / level-up (events come in bursts). */
const SPELL_SETTLE = 0.5;

/** Fired once, at the first login of the session (after the settings are loaded). */
export const booted = createSignal();

let addonName = "";
let isBooted = false;
let ticker: TimerHandle | undefined;
/** The buff and weapon spell that glowed last tick, as "buff:weapon". */
let lastGlowKey: string | undefined;
let lastBuffGlow: number[] = [];
let lastWeaponSound: number | undefined;
let lastNoticeKey: string | undefined;
let lastNoticeAt = 0;
/** When the bars last changed (a form, a stance, a page, a slot); the old map is wrong until remapped. */
let barsChangedAt = -10;

/** Forces the glows to be set again on the next tick. */
function invalidateTick(): void {
    lastGlowKey = undefined;
}

/** One message with every current line: missing buffs on no bar, party buffs, old ranks. */
function showNotices(notOnBars: number[], party: PartySuggestion[], isIdle: boolean): void {
    if (GetTime() - barsChangedAt <= NOTICE_AFTER_BAR_CHANGE) return;
    const keys: string[] = [];
    const lines: string[] = [];
    if (settings.showBarNotice && notOnBars.length > 0) {
        keys.push(`bar:${notOnBars.join(",")}`);
        lines.push(string.format(getText("NOTICE_NOT_ON_BAR"), notOnBars.map((id) => getSpellName(id) ?? "?").join(", ")));
    }
    for (const suggestion of party) {
        const names = suggestion.names.join(", ");
        keys.push(`party:${suggestion.spellId}:${names}`);
        lines.push(string.format(getText("NOTICE_PARTY"), getSpellName(suggestion.spellId) ?? "?", names));
    }
    if (settings.showRankNotice && !isIdle) {
        for (const entry of findOutdatedRanks()) {
            keys.push(`${entry.id}:${entry.onBar}>${entry.best}`);
            lines.push(string.format(getText("NOTICE_OLD_RANK"), entry.name, entry.onBar, entry.best));
        }
    }
    if (lines.length === 0) {
        lastNoticeKey = undefined;
        return;
    }
    const key = keys.join(";");
    const now = GetTime();
    if (key === lastNoticeKey && now - lastNoticeAt <= NOTICE_REPEAT) return;
    lastNoticeKey = key;
    lastNoticeAt = now;
    showNotice(lines.join("\n"));
}

function tick(): void {
    if (!isBooted) return;
    rememberSelfBuffs();

    // Nothing while dead, mounted, eating or resting in town
    const isIdle = shouldStayIdle(settings.hideResting) || settings.isMuted;
    const buffs = settings.showBuff && !isIdle ? findMissingBuffs() : { glow: [], notOnBars: [] };
    const party = settings.showBuff && !isIdle ? findPartyBuffSuggestions() : [];
    const weaponCheck = settings.showWeapon && !isIdle ? weaponReminder.check() : undefined;
    // The player's own missing buffs, then the party buffs that can be cast from the bars
    const buff = [...buffs.glow];
    for (const suggestion of party) {
        if (!buff.includes(suggestion.spellId) && isOnBars(suggestion.spellId) && isCastable(suggestion.spellId) !== false) {
            buff.push(suggestion.spellId);
        }
    }
    const weapon = weaponCheck?.isNeeded ? weaponCheck.spellId : undefined;

    // A sound when a buff starts glowing, not each time another one goes out
    if (buff.some((id) => !lastBuffGlow.includes(id))) playAlertSound(settings.soundBuff);
    lastBuffGlow = buff;
    if (weapon !== undefined && weapon !== lastWeaponSound) playAlertSound(settings.soundWeapon);
    lastWeaponSound = weapon;

    showNotices(buffs.notOnBars, party, isIdle);

    const glowKey = `${buff.join(",")}:${weapon ?? 0}`;
    if (glowKey !== lastGlowKey) {
        lastGlowKey = glowKey;
        buffGlow.show(buff);
        weaponGlow.show(weapon !== undefined ? [weapon] : []);
    }
}

/** A switch changed: glows that are now off go out at once; a new color lights them again. */
function onSettingChanged(key: string): void {
    if (key === "colors" || !settings.showBuff) buffGlow.clear();
    if (key === "colors" || !settings.showWeapon) weaponGlow.clear();
    invalidateTick();
    tick();
}

// ---------------------------------------------------------------------------------------------
// Scheduling

let isTickQueued = false;
let spellFlushGeneration = 0;
let barFlushGeneration = 0;

/** A tick on the next frame (several requests in one frame give one tick). */
function requestTick(): void {
    invalidateTick();
    if (isTickQueued) return;
    isTickQueued = true;
    C_Timer.After(0, () => {
        isTickQueued = false;
        tick();
    });
}

function forceTick(): void {
    wipeAuraScans();
    requestTick();
}

function scheduleBarFlush(): void {
    barsChangedAt = GetTime();
    barFlushGeneration += 1;
    const generation = barFlushGeneration;
    C_Timer.After(BAR_SETTLE, () => {
        if (generation !== barFlushGeneration) return;
        mapBars(true);
        requestTick();
    });
}

/**
 * On learning or levelling only the failed spell lookups are cleared, so a new rank resolves; the
 * spellbook is not walked again (that froze the client on quest turn-in).
 */
function scheduleSpellFlush(): void {
    spellFlushGeneration += 1;
    const generation = spellFlushGeneration;
    C_Timer.After(SPELL_SETTLE, () => {
        if (generation !== spellFlushGeneration) return;
        invalidateSpells(false);
        requestTick();
        scheduleBarFlush();
    });
}

/** Arriving in a town or an inn (where reagents are sold): name the ones running low. */
let wasResting = false;
function checkReagentsOnArrival(): void {
    const isRestingNow = isResting();
    const hasArrived = isRestingNow && !wasResting;
    wasResting = isRestingNow;
    if (!hasArrived || !settings.showReagentNotice || settings.isMuted) return;
    const low = findLowReagents();
    if (low.length === 0) return;
    const message = string.format(getText("NOTICE_REAGENTS_LOW"), low.map((stock) => `${stock.name} (${stock.count})`).join(", "));
    say(message);
    showNotice(message);
}

// ---------------------------------------------------------------------------------------------
// Events

let mainHandItem: number | undefined;
let offHandItem: number | undefined;
let lastPlayerCastName: string | undefined;

function getWeaponItemId(slot: number): number | undefined {
    const id = attempt(GetInventoryItemID, "player", slot);
    return type(id) === "number" ? id : undefined;
}

function onLogin(shouldGreet: boolean): void {
    if (!isBooted) {
        isBooted = true;
        invalidateSpells(true);
        rebuildSpellBook(false);
        mapBars(true);
        ticker = C_Timer.NewTicker(TICK_SECONDS, () => tick());
        booted.emit();
    }
    mainHandItem = getWeaponItemId(MAIN_HAND_SLOT);
    offHandItem = getWeaponItemId(OFF_HAND_SLOT);
    if (shouldGreet) say(getText("INIT"));
    tick();
    checkReagentsOnArrival();
}

function onEquipmentChanged(slot: number): void {
    if (slot === MAIN_HAND_SLOT || slot === OFF_HAND_SLOT) {
        const id = getWeaponItemId(slot);
        const previous = slot === MAIN_HAND_SLOT ? mainHandItem : offHandItem;
        if (id !== previous) {
            if (slot === MAIN_HAND_SLOT) mainHandItem = id;
            else offHandItem = id;
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
function onSpellCast(spellId: number | undefined): void {
    const castName = lastPlayerCastName;
    lastPlayerCastName = undefined;
    const id = spellId === undefined || issecretvalue(spellId) ? resolveFromName(castName) : spellId;
    noteSelfBuff(id);
    weaponReminder.noteCast(id ?? spellId, castName);
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
export function start(name: string): void {
    addonName = name;
    spellBookIndexed.listen(() => {
        invalidateTick();
        tick();
    });
    barsMapped.listen(invalidateTick);
    settingChanged.listen(onSettingChanged);

    const stopLoading = onEvent("ADDON_LOADED", (loaded) => {
        if (loaded !== addonName) return;
        stopLoading();
        loadSettings();
    });
    onEvent("PLAYER_LOGIN", () => onLogin(true));
    onEvent("PLAYER_ENTERING_WORLD", () => onLogin(false));
    onEvent("PLAYER_LOGOUT", () => {
        ticker?.Cancel();
        ticker = undefined;
    });

    // Do NOT listen to SPELLS_CHANGED: Forever fires it in storms on quest turn-in and level-up,
    // and rebuilding on it froze the client
    onEvent("LEARNED_SPELL_IN_SKILL_LINE", (spellId) => {
        noteLearnedSpell(spellId);
        scheduleSpellFlush();
    });
    onEvent("PLAYER_TALENT_UPDATE", scheduleSpellFlush);
    onEvent("PLAYER_LEVEL_UP", scheduleSpellFlush);

    onEvent("SPELL_PUSHED_TO_ACTIONBAR", scheduleBarFlush);
    onEvent("ACTIONBAR_SLOT_CHANGED", scheduleBarFlush);
    onEvent("ACTIONBAR_PAGE_CHANGED", scheduleBarFlush);
    onEvent("UPDATE_SHAPESHIFT_FORM", () => {
        noteFormChange();
        scheduleBarFlush();
    });

    onEvent("PLAYER_UPDATE_RESTING", () => {
        forceTick();
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
        onEvent(event, forceTick);
    }

    // No forced tick on auras: aura storms would feel like input lag; the ticker reads them again
    onPlayerEvent("UNIT_AURA", (unit) => wipeAuraScan(unit));
    onPlayerEvent("UNIT_INVENTORY_CHANGED", () => {
        clearWeaponTooltipCache();
        requestTick();
    });
    onPlayerEvent("UNIT_SPELLCAST_START", () => {
        const [didSucceed, name] = attemptMulti(() => UnitCastingInfo("player"));
        if (didSucceed && isReadable(name) && type(name) === "string") lastPlayerCastName = name;
    });
    onPlayerEvent("UNIT_SPELLCAST_SUCCEEDED", (_unit, _castGuid, spellId) => onSpellCast(spellId));

    onEvent("PLAYER_EQUIPMENT_CHANGED", onEquipmentChanged);
    onEvent("WEAPON_ENCHANT_CHANGED", () => {
        clearWeaponTooltipCache();
        weaponReminder.noteEnchantChanged();
        requestTick();
    });

    onEvent("ADDON_ACTION_BLOCKED", noteBlockedAction);
    onEvent("ADDON_ACTION_FORBIDDEN", noteBlockedAction);
}
