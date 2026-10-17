// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Rank Reminder",
    INIT: "Initialized",
    TAB_REMINDERS: "Reminders",

    OPT_HOME_TEXT:
        "A message names every spell on your action bars that is a lower rank than the one you know, so a new rank never stays unused on a bar by accident. It never casts anything.",
    OPT_HOME_HELP: "To report a problem, open an issue on GitHub with the link below and say what you saw.",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns the message off on this character only. Your other characters keep their settings.",
    OPT_HIDE_RESTING: "Stay quiet in towns and inns",
    TIP_HIDE_RESTING: "No message while you are resting in a town or an inn and not in combat. Switch it off to get it there too.",

    NOTICE_OLD_RANK: "%s: Rank %d is on your action bar, but you know Rank %d.",
};

export type TextKey = keyof typeof TEXTS;
