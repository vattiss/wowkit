import { isSoundKey } from "@wowkit/ui";
import type { AddonSettings, ColorKey, CueKind, Style, StyleOverride } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "GlowingBarsCharDB";

export function createDefaultSettings(): AddonSettings {
    return {
        isMuted: false,
        hideResting: true,
        showBuff: true,
        showWeapon: true,
        showPartyBuffs: true,
        showRanks: true,
        showReagents: true,
        showCooldowns: true,
        showCooldownsOutOfCombat: false,
        showCooldownsAtFightStart: false,
        cooldownGlowSeconds: 3,
        showProcs: true,
        showSeals: true,
        showTracking: true,
        styles: {},
        spellStyles: {},
        buffOn: {},
        barOff: {},
        idOverrides: {},
        customCues: [],
        reagentOn: {},
        rankOff: {},
        glowOn: {},
    };
}

/** The look of each kind of reminder until the player changes it. The old ranks and the low reagents are a quiet hint. */
export const STYLE_DEFAULTS: { [key in ColorKey]: Style } = {
    buff: { color: [0.2, 0.55, 1], opacity: 100, isTextOn: false, sound: "none" },
    weapon: { color: [1, 0.55, 0.1], opacity: 100, isTextOn: false, sound: "alarm2" },
    // The paladin's gold
    seal: { color: [1, 0.85, 0.2], opacity: 100, isTextOn: false, sound: "none" },
    // #67FFF8, the cyan of the minimap's tracking
    tracking: { color: [0.4, 1, 0.97], opacity: 100, isTextOn: false, sound: "none" },
    cooldown: { color: [1, 1, 1], opacity: 100, isTextOn: false, sound: "none" },
    proc: { color: [1, 0.12, 0.08], opacity: 100, isTextOn: false, sound: "none" },
    rank: { color: [1, 0.85, 0.2], opacity: 50, isTextOn: true, sound: "alarm1" },
    reagent: { color: [1, 0.85, 0.2], opacity: 50, isTextOn: false, sound: "none" },
};

/** The choices of how long a cooldown glows once it is back (seconds; 0 = until it is pressed). */
export const COOLDOWN_GLOW_CHOICES = [2, 3, 5, 10, 0];

/** The kinds a spell can be added as, in the order the add button goes through them. */
export const CUE_KINDS: CueKind[] = ["cooldown", "proc", "buff", "weapon", "reagent", "seal", "tracking"];

/** The kinds in the order the tables list them. */
export const KIND_ORDER: ColorKey[] = ["buff", "weapon", "seal", "tracking", "reagent", "cooldown", "proc", "rank"];

/** The part of a saved look that can be used: a sound that is no longer in the list, or a color that is no color, is dropped. */
function repairStyle(style: StyleOverride | undefined): StyleOverride | undefined {
    if (style === undefined || type(style) !== "table") return undefined;
    const repaired: StyleOverride = {};
    if (isSoundKey(style.sound)) repaired.sound = style.sound;
    if (type(style.isTextOn) === "boolean") repaired.isTextOn = style.isTextOn;
    const opacity = tonumber(style.opacity);
    if (opacity !== undefined) repaired.opacity = math.max(1, math.min(100, math.floor(opacity + 0.5)));
    const color = style.color;
    if (color !== undefined && type(color) === "table" && tonumber(color[0]) !== undefined) {
        repaired.color = [color[0], color[1] ?? 0, color[2] ?? 0];
    }
    return repaired;
}

/** Puts right what a saved look got wrong. */
export function repairSettings(values: AddonSettings): void {
    // An added spell that is not a number and a kind is dropped
    values.customCues = (values.customCues ?? []).filter(
        (cue) => type(cue) === "table" && tonumber(cue.id) !== undefined && CUE_KINDS.includes(cue.kind),
    );
    if (!COOLDOWN_GLOW_CHOICES.includes(values.cooldownGlowSeconds))
        values.cooldownGlowSeconds = createDefaultSettings().cooldownGlowSeconds;
    for (const kind of KIND_ORDER) values.styles[kind] = repairStyle(values.styles[kind]);
    for (const [name, style] of pairs(values.spellStyles)) values.spellStyles[name as string] = repairStyle(style);
}
