// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Reagent Reminder",
    INIT: "This addon has moved: please install Glowing Bars from CurseForge and remove this one",

    HDR_ABOUT: "Help",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns the message off on this character only. Your other characters keep their settings.",

    OPT_SOUND: "Sound",
    TIP_SOUND: "Plays when the message appears. Choosing a sound plays it once as a preview.",
    HDR_REAGENTS: "Reagents",
    TIP_REAGENT_ONE: "Tell me when I run low on this reagent.",

    NOTICE_REAGENTS_LOW: "Reagents running low: %s",
};

export type TextKey = keyof typeof TEXTS;
