// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Buff Reminder",
    INIT: "Initialized",

    HDR_ABOUT: "Help",
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
    TIP_BUFF: "Every missing buff of the list below glows on its action button (one per category, e.g. one aspect).",
    TIP_BUFF_ONE: "Remind me when this buff is missing. Of a category (aspects, paladin auras, armors) any one counts.",
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

    HDR_MESSAGES: "Messages",
    OPT_BAR_NOTICE: "Missing buffs not on your bars",
    TIP_BAR_NOTICE: "A message names the missing buffs you have learned but put on no action bar.",
    NOTICE_NOT_ON_BAR: "Missing buff, not on your action bars: %s",
    NOTICE_PARTY: "%s missing on: %s",

    BLOCKED_ACTION: "The game blocked an action of this addon (%s). Please report it.",
};

export type TextKey = keyof typeof TEXTS;
