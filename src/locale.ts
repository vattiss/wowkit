// English only: every player-facing string of the addon.
const L = {
    TITLE: "Forever Reminders",
    INIT: "Initialized",
    TAB_REMINDERS: "Reminders",
    TAB_DEBUG: "Debug report",

    OPT_HOME_TEXT:
        "Reminds you of what is easy to forget while you level: a missing buff or weapon buff glows on its action button, and a message tells you when one of those spells is not on your action bars, when a bar still holds an older rank of a spell you know, when a party member misses your buff, or when your reagents run low. It never casts anything.",
    OPT_HOME_HELP:
        "To report a problem, switch on Reminders > Collect debug data, play until it happens, then press Debug report on the Debug report page, copy the text and paste it into the issue link below.",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns every glow, sound and message off on this character only. Your other characters keep their settings.",
    OPT_HIDE_RESTING: "Stay quiet in towns and inns",
    TIP_HIDE_RESTING:
        "No glow or message while you are resting in a town or an inn and not in combat. Switch it off to get the reminders there too.",

    HDR_BUFFS: "Buffs",
    OPT_BUFF: "Highlight a missing buff",
    TIP_BUFF: "Every missing buff of the list below glows on its action button (one per group, e.g. one aspect).",
    TIP_BUFF_ONE: "Remind me when this buff is missing. Of a group (aspects, paladin auras, armors) any one counts.",
    OPT_COLOR_BUFF: "Buff color",
    OPT_PARTY_BUFFS: "Party members missing your buffs",
    TIP_PARTY_BUFFS:
        "Out of combat, a message names the party members in range who miss one of your buffs, and its button glows. When two or more miss it and you have the reagent, the group version (Prayer of Fortitude, Gift of the Wild...) is suggested. Not in raids.",

    HDR_WEAPON: "Weapon buff",
    OPT_WEAPON: "Highlight the weapon buff",
    TIP_WEAPON: "The weapon buff lights up when it is missing or about to expire.",
    OPT_WEAPON_PICK: "Weapon buff to keep up",
    OPT_WEAPON_PICK_MAIN: "Main-hand poison",
    OPT_WEAPON_PICK_OFF: "Off-hand poison",
    TIP_WEAPON_PICK:
        "Automatic reminds you of the best weapon buff you have already learned (it changes as you level). Only learned buffs are listed.",
    OPT_AUTOMATIC: "Automatic",
    OPT_COLOR_WEAPON: "Weapon buff color",

    OPT_SOUND: "Sound",
    TIP_SOUND: "Plays when this highlight appears. Choosing a sound plays it once as a preview.",
    SND_NONE: "No sound",
    SND_PING: "Map ping",
    SND_READY: "Ready check",
    SND_RAID: "Raid warning",
    SND_ALARM: "Alarm clock",
    SND_WHISPER: "Whisper",
    SND_QUEST: "Quest complete",
    SND_TOAST: "Toast",
    SND_CLICK: "Click",

    HDR_MESSAGES: "Messages",
    OPT_BAR_NOTICE: "Missing buffs not on your bars",
    TIP_BAR_NOTICE: "A message names the missing buffs you have learned but put on no action bar.",
    OPT_RANK_NOTICE: "Old spell ranks on your bars",
    TIP_RANK_NOTICE: "A message names every spell on your action bars that is a lower rank than the one you have learned.",
    NOTICE_NOT_ON_BAR: "Missing buff, not on your action bars: %s",
    NOTICE_OLD_RANK: "%s: Rank %d is on your action bar, but you know Rank %d.",
    NOTICE_PARTY: "%s missing on: %s",
    OPT_REAGENT_NOTICE: "Reagents running low",
    TIP_REAGENT_NOTICE: "When you arrive in a town or an inn, a message names the reagents of your group buffs you have 5 or fewer of.",
    NOTICE_REAGENTS_LOW: "Reagents running low: %s",

    HDR_DEBUG: "Debug",
    OPT_DEBUG: "Collect debug data",
    TIP_DEBUG:
        "Samples what the game really answers (secret, empty, a value) once a second. Turn it on while testing, then press Debug report on the Debug report page and send the text. Off by default; it costs a little CPU.",
    OPT_DEBUG_HINT:
        "Press Debug report, then copy the text with Ctrl+C and paste it into your issue. The report holds no character name, realm or chat.",
    OPT_DEBUG_REPORT: "Debug report",
    OPT_DEBUG_CLEAR: "Clear debug data",
    OPT_DEBUG_CLEARED: "Debug data cleared.",

    BLOCKED_ACTION: "The game blocked an action of this addon (%s). Please report it with the debug report.",
};

export type TextKey = keyof typeof L;

export function T(key: TextKey): string {
    return L[key];
}

export function say(message: string): void {
    print(`|cff66ccff${L.TITLE}|r: ${message}`);
}
