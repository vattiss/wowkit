// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Rank Reminder",
    INIT: "This addon has moved: please install Glowing Bars from CurseForge and remove this one",

    HDR_ABOUT: "Help",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns the message off on this character only. Your other characters keep their settings.",
    OPT_HIDE_RESTING: "Stay quiet in towns and inns",
    TIP_HIDE_RESTING: "No message while you are resting in a town or an inn and not in combat. Switch it off to get it there too.",

    OPT_SOUND: "Sound",
    TIP_SOUND: "Plays when the message appears. Choosing a sound plays it once as a preview.",

    NOTICE_OLD_RANK: "%s: Rank %d is on your action bar, but you know Rank %d.",
};

export type TextKey = keyof typeof TEXTS;
