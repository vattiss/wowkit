// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Reagent Reminder",
    INIT: "Initialized",
    TAB_REMINDERS: "Reminders",

    OPT_HOME_TEXT:
        "When you arrive in a town or an inn, a message names the reagents of your group buffs (Prayer of Fortitude, Gift of the Wild, Arcane Brilliance, the Greater Blessings) that you have 5 or fewer of. It never casts anything.",
    OPT_HOME_HELP: "To report a problem, open an issue on GitHub with the link below and say what you saw.",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns the message off on this character only. Your other characters keep their settings.",

    NOTICE_REAGENTS_LOW: "Reagents running low: %s",
};

export type TextKey = keyof typeof TEXTS;
