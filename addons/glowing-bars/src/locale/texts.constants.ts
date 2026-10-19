// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Glowing Bars",
    INIT: "Initialized. Type /gb to set how the reminders look.",

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

    HDR_COOLDOWNS: "Ready cooldowns",
    OPT_COOLDOWNS: "Highlight important cooldowns that are ready",
    TIP_COOLDOWNS:
        "In a fight, an important cooldown of your class or your race glows on its action button when it is ready again after you used it (or after it was running as the fight began), for the time chosen below. The list below is what you can switch off.",
    OPT_COOLDOWNS_OUT_OF_COMBAT: "Also out of combat",
    TIP_COOLDOWNS_OUT_OF_COMBAT: "By default the cooldowns glow in combat only.",
    OPT_COOLDOWN_SECONDS: "Glow when it is back",
    TIP_COOLDOWN_SECONDS: "In a fight, how long a cooldown glows once it is ready again.",
    OPT_SECONDS: "%d seconds",
    OPT_UNTIL_PRESSED: "Until it is pressed",
    OPT_COLOR_COOLDOWN: "Cooldown color",
    TIP_GLOW_ONE: "Highlight this spell when it is ready.",

    HDR_PROCS: "Procs",
    OPT_PROCS: "Highlight spells that become usable",
    TIP_PROCS:
        "A spell glows while the game says it can be used: Overpower after a dodge, Revenge after a block, Execute on a low target, and the like.",
    OPT_COLOR_PROC: "Proc color",

    HDR_RANKS: "Old ranks",
    OPT_RANKS: "Name spells on your bars at an old rank",
    TIP_RANKS: "A spell on your action bars that is a lower rank than the one you know glows, quietly.",

    HDR_REAGENTS: "Reagents",
    OPT_REAGENTS: "Tell me about low reagents in town",
    TIP_REAGENTS:
        "The group buff on your action bar glows, quietly, while its reagent runs low. On arriving in a town or an inn a message names the reagents.",
    TIP_REAGENT_ONE: "Tell me when I run low on this reagent.",

    HDR_LOOKS: "Looks",
    OPT_TABLE: "Colors, opacity, messages and sounds",
    TIP_TABLE: "A table with the look of each kind of reminder, and of each spell of your class. Also /gb.",
    BTN_OPEN: "Open the table",
    BTN_RESET: "Reset",
    TABLE_TITLE: "Glowing Bars: looks",
    HDR_TABLE_DEFAULTS: "Each kind of reminder",
    HDR_TABLE_SPELLS: "Your spells (a change here wins over the kind)",
    COL_SPELL: "Spell",
    COL_KIND: "Kind",
    COL_COLOR: "Color",
    COL_OPACITY: "Glow %",
    COL_MESSAGE: "Message",
    COL_SOUND: "Sound (click)",
    NO_COLOR_PICKER: "This client has no color picker the addon can use.",
    KIND_BUFF: "Missing buff",
    KIND_WEAPON: "Weapon buff",
    KIND_COOLDOWN: "Ready cooldown",
    KIND_PROC: "Proc",
    KIND_RANK: "Old rank",
    KIND_REAGENT: "Low reagent",
    TEXT_BUFF: "Missing buff",
    TEXT_WEAPON: "Weapon buff",
    TEXT_COOLDOWN: "Cooldown ready",
    TEXT_PROC: "Proc",
    TEXT_RANK: "Old spell rank",
    NOTICE_NOT_ON_BAR: "Missing buff, not on your action bars: %s",
    NOTICE_PARTY: "%s missing on: %s",
    NOTICE_REAGENTS_LOW: "Reagents running low: %s",

    BLOCKED_ACTION: "The game blocked an action of this addon (%s). Please report it.",
};

export type TextKey = keyof typeof TEXTS;
