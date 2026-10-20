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

    HDR_BARS: "Action bars that glow",
    OPT_BAR: "Action Bar %d",
    TIP_BAR:
        "The buttons of this bar glow. Switch a bar off to keep its buttons calm, for example when the same spells are on a bar of cooldowns next to your character.",

    HDR_BUFFS: "Buffs",
    OPT_PARTY_BUFFS: "Party members missing your buffs",
    TIP_PARTY_BUFFS:
        "Out of combat, a message names the party members in range who miss one of your buffs, and its button glows. When two or more miss it and you have the reagent, the group version (Prayer of Fortitude, Gift of the Wild...) is suggested. Not in raids.",

    HDR_WEAPON: "Weapon buff",
    OPT_WEAPON_PICK: "Weapon buff to keep up",
    OPT_WEAPON_PICK_MAIN: "Main-hand poison",
    OPT_WEAPON_PICK_OFF: "Off-hand poison",
    TIP_WEAPON_PICK:
        "Automatic reminds you of the best weapon buff you have already learned (it changes as you level). Only learned buffs are listed.",
    OPT_AUTOMATIC: "Automatic",

    HDR_COOLDOWNS: "Ready cooldowns",
    OPT_COOLDOWNS_OUT_OF_COMBAT: "Also out of combat",
    TIP_COOLDOWNS_OUT_OF_COMBAT: "By default the cooldowns glow in combat only.",
    OPT_COOLDOWNS_FIGHT_START: "Also at the start of a fight",
    TIP_COOLDOWNS_FIGHT_START:
        "When a fight starts, every ready cooldown glows for the time below too, so you remember to use it (Berserking, Recklessness...).",
    OPT_COOLDOWN_SECONDS: "Glow when it is back",
    TIP_COOLDOWN_SECONDS: "In a fight, how long a cooldown glows once it is ready again.",
    OPT_SECONDS: "%d seconds",
    OPT_UNTIL_PRESSED: "Until it is pressed",

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
    COL_ID: "Spell ID",
    COL_ON: "Enabled",
    TIP_ENABLED_KIND:
        "Switches this whole kind of reminder on or off. While it is off, none of its spells glow, whatever their own Enabled box says; their rows are faded.",
    TIP_ENABLED_SPELL: "Switches this one spell on or off.",
    HDR_TABLE_ADD: "Add a spell (by its ID)",
    BTN_ADD: "Add",
    MSG_UNKNOWN_SPELL: "The client knows no spell with the ID %d.",
    MSG_ALREADY_LISTED: "%s is in the list already.",
    MSG_NO_COOLDOWN: "%s has no cooldown: %s",
    MSG_NO_REAGENT: "The tooltip of %s names no reagent: %s",
    MSG_CHOOSE_KIND: "choose another kind.",
    MSG_ADDED_AS: "added as %s instead.",
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
