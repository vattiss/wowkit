// English only: every player-facing string of the addon.
export const TEXTS = {
    TITLE: "Know Your Rotation",
    INIT: "Initialized",

    HDR_ABOUT: "Help",
    INFO_GITHUB: "GitHub",
    INFO_ISSUES: "Report an issue",
    INFO_COPY: "Copy",
    INFO_COPIED: "The link is in the chat box. Press Ctrl+C to copy.",

    HDR_CHARACTER: "This character",
    OPT_MUTE: "Disable on this character",
    TIP_MUTE: "Turns every glow and sound off on this character only. Your other characters keep their settings.",
    OPT_HIDE_RESTING: "Stay quiet in towns and inns",
    TIP_HIDE_RESTING: "No glow while you are resting in a town or an inn and not in combat. Switch it off to get the glows there too.",

    HDR_ROTATION: "Rotation",
    OPT_ROTATION: "Highlight the next rotation spell",
    TIP_ROTATION: "The next spell to press lights up on your action bars. Heals in your list light up when your health asks for them.",
    OPT_COLOR_NEXT: "Next spell color",
    OPT_COLOR_HEAL: "Heal color (HoT, shield: keep it up)",
    OPT_COLOR_HEALNOW: "Quick heal color (press when needed)",
    OPT_COLOR_SHOT: "Auto Shot / Concussive Shot color",
    OPT_PHYSICS: "Classic Auto Shot timing",
    TIP_PHYSICS: "Holds Aimed Shot, Multi-Shot and Volley for a moment right before an Auto Shot, so they do not delay it.",

    HDR_DEFENSE: "Defense",
    OPT_DEFENSE: "Highlight defensive spells",
    TIP_DEFENSE:
        "Defensive cooldowns light up when your health is low (Shield Wall, Divine Protection, Ice Block...). Your long buffs are Buff Reminder's.",
    OPT_COLOR_DEFENSE: "Defense color",

    HDR_INTERRUPT: "Interrupt",
    OPT_INTERRUPT: "Highlight the interrupt",
    TIP_INTERRUPT: "Your interrupt lights up while the target is casting something you can interrupt.",
    HDR_PURGE: "Purge",
    OPT_PURGE: "Highlight the purge",
    TIP_PURGE: "Your purge lights up when the target has a magic effect you can remove.",
    HDR_CLEANSE: "Cleanse",
    OPT_CLEANSE: "Highlight the cleanse",
    TIP_CLEANSE: "Your cleanse lights up when you have an effect you can remove.",
    OPT_CLEANSE_GROUP: "Also cleanse your group",
    TIP_CLEANSE_GROUP: "Also for your party, your target, your focus and the unit under the mouse.",

    HDR_TOTEM: "Totems",
    OPT_TOTEM: "Highlight the totems",
    TIP_TOTEM:
        "The totems in your totem bar light up when they are missing and worth dropping: buff totems at the start of the fight, slows and area totems once enemies are in melee. The rotation keeps going.",
    OPT_COLOR_TOTEM: "Totem color",

    OPT_SOUND: "Sound",
    TIP_SOUND: "Plays when this highlight appears. Choosing a sound plays it once as a preview.",

    HDR_BEHAVIOR: "Role and mode",
    OPT_ROLE: "Role",
    TIP_ROLE:
        "Automatic picks the role from your main talent tree (Protection: tank; Holy, Discipline, Restoration: heal; anything else: damage) and, for hunters and shamans, the distance to your target. Pick a role to keep it fixed.",
    OPT_COMBAT_MODE: "Combat mode",
    TIP_COMBAT_MODE:
        "Automatic uses the single-target list and switches to the AoE list once enough enemies fight you (nameplates must be on).",
    OPT_AOE_FROM: "AoE from (enemies)",
    TIP_AOE_FROM: "How many enemies fighting you switch the automatic mode to the AoE list.",
    OPT_AUTO_HEAL: "Smart heal threshold",
    TIP_AUTO_HEAL: "A heal is offered once the health you are missing is about the size of the heal, so it is not wasted.",
    OPT_AUTOMATIC: "Automatic",

    ROLE_DAMAGE: "Damage",
    ROLE_TANK: "Tank",
    ROLE_HEAL: "Heal",
    ROLE_HYBRID: "Hybrid",
    ROLE_CASTER: "Caster",
    ROLE_MELEE: "Melee",
    ROLE_RANGE: "Ranged",
    MODE_SINGLE: "Single target",
    MODE_AOE: "AoE",
};

export type TextKey = keyof typeof TEXTS;
