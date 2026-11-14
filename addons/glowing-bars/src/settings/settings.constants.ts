import { isSoundKey } from "@wowkit/ui";
import { tryCall, type GlowAnimation } from "@wowkit/wow";
import { convertOldSettings } from "./settings-migration";
import type { AddonSettings, ReminderType, AddableType, StyleOverride, When, MessageTextChoice } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "GlowingBarsCharDB";
/** The account's saved data (## SavedVariables): what it has seen of the releases. */
export const ACCOUNT_VARIABLES_NAME = "GlowingBarsDB";

/** The setting of whether each window of the Cooldown Manager is on the screen. */
export const WINDOW_ICONS_SETTINGS = {
    trackedBuffs: "trackedBuffsIcons",
    trackedBars: "trackedBarsIcons",
    essential: "essentialIcons",
    utility: "utilityIcons",
} as const;

/** Every window of the Cooldown Manager kept out of sight, for a player who did not use it. */
const HIDDEN_WINDOWS = { trackedBuffsIcons: "hide", trackedBarsIcons: "hide", essentialIcons: "hide", utilityIcons: "hide" } as const;

/** The lines the addon writes in the chat by itself: the greeting, and the notes of a buff of an older rank. */
const CHAT_LINES = { shouldShowGreeting: true, shouldNoteOwnOlderRankBuffs: true, shouldNoteOthersOlderRankBuffs: true } as const;

/** The shaman's totems: whether a totem gone glows, and the last dropped in each slot (none yet). */
function createTotemSettings(): Pick<AddonSettings, "isTotemGoneEnabled" | "lastTotems"> {
    return { isTotemGoneEnabled: true, lastTotems: {} };
}

export function createDefaultSettings(): AddonSettings {
    return {
        isDisabled: false,
        ...CHAT_LINES,
        shouldStayQuietInTowns: false,
        isAfkRainbowOn: false,
        shouldGlowOnMacros: true,
        shouldGlowOnEveryMacroSpell: false,
        isWelcomeDone: false,
        isCooldownChoiceSeen: false,
        cooldownManagerAccess: "full",
        ...HIDDEN_WINDOWS,
        isTrackedBarsSplit: false,
        isCooldownManagerSetUp: false,
        isCooldownManagerOurs: false,
        roundAnimation: "breathing",
        isMissingBuffEnabled: true,
        isWeaponBuffEnabled: true,
        messageSize: 100,
        messageTop: 180,
        isMessageZoomInOn: true,
        isMessageZoomOutOn: true,
        isMessageFadePulseOn: false,
        isMessageSizePulseOn: false,
        messagePulseSpeed: 100,
        isOneLinePerType: false,
        showPartyBuffs: true,
        showRaidBuffs: true,
        partyGroupFrom: 2,
        raidGroupFrom: 1,
        isOldRankEnabled: true,
        isLowReagentEnabled: true,
        isReadyCooldownEnabled: true,
        reagentBelow: 10,
        stockBelow: 20,
        isLowStockEnabled: true,
        belowLimits: {},
        isProcEnabled: true,
        isMissingSealEnabled: true,
        isMissingTrackingEnabled: true,
        ...createTotemSettings(),
        styles: {},
        spellStyles: {},
        enabledBuffs: {},
        // The windows of the Cooldown Manager glow only if the player turns them on
        barsThatGlow: { trackedBuffs: false, trackedBars: false, essential: false, utility: false },
        fadedBars: {},
        fadedOpacity: 50,
        showTooltipIds: false,
        isTableAdvanced: false,
        customSoundFolders: [{ folder: CUSTOM_SOUND_FOLDER, count: 0 }],
        idOverrides: {},
        addedSpells: [],
        enabledReagents: {},
        enabledRanks: {},
        enabledSpells: {},
        lastBuffs: {},
        fedBuffs: {},
        fedItems: {},
    };
}

export { DEFENSIVE_EXECUTE_ROW, SPELL_STYLE_DEFAULTS, STYLE_DEFAULTS } from "./style-defaults.constants";

/**
 * When a reminder of the reminderType may show: by combat or a target; a ready cooldown also as a fight starts, the low
 * reagents and the low stock also with their alert in a town.
 */
export function listWhenChoices(reminderType: ReminderType): When[] {
    if (reminderType === "readyCooldown") return ["always", "inCombat", "inCombatStart", "outOfCombat", "enemyTargeted"];
    const choices: When[] = ["always", "inCombat", "outOfCombat", "enemyTargeted"];
    return reminderType === "lowReagent" || reminderType === "lowStock" ? [...choices, "townAlert"] : choices;
}

/** The folder in AddOns for sound files of the player's own that the table starts with: next to the addon, so an update leaves it alone. */
export const CUSTOM_SOUND_FOLDER = "GlowingBars_Sounds";

/** What a folder added in the table starts as, to change into the player's own. */
export const NEW_SOUND_FOLDER = "GlowingBars_My_Sounds";

/** The choices of how often a sound repeats while its glow is on (seconds; 0 = once). */
export const REPEAT_CHOICES = [0, 5, 10, 30, 60];

/** The choices of how visible a faded bar's buttons are, in percent. */
export const FADED_OPACITY_CHOICES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** The choices of how a glow moves. */
export const ANIMATION_CHOICES: GlowAnimation[] = [
    "circling",
    "clean",
    "circlingClassic",
    "circlingOriginal",
    "breathing",
    "breathingClean",
    "breathingClassic",
    "breathingOriginal",
    "none",
    "noneClean",
    "noneClassic",
    "noneOriginal",
];

/** The choices of how long a reminder shows once it is due (seconds; 0 = until it is done). */
export const GLOW_TIME_CHOICES = [0, 1, 2, 3, 5, 10];

/** The choices of from how many missing a buff its group version is asked for. */
export const GROUP_FROM_CHOICES = [1, 2, 3, 4, 5];

/** The types a spell can be added as, in the order the add button goes through them. */
export const ADDABLE_TYPES: AddableType[] = [
    "readyCooldown",
    "proc",
    "missingBuff",
    "weaponBuff",
    "lowReagent",
    "lowStock",
    "missingSeal",
    "missingTracking",
];

/** The types in the order the tables list them. */
export const TYPE_ORDER: ReminderType[] = [
    "missingBuff",
    "weaponBuff",
    "missingSeal",
    "missingTracking",
    "totemGone",
    "lowReagent",
    "lowStock",
    "readyCooldown",
    "proc",
    "oldRank",
];

/** A saved value that is one of the choices; undefined for any other. */
/** How long a message can stay, in seconds; 0 is as long as the button glows. */
export const MESSAGE_SHOW_FOR_CHOICES = [5, 10, 20, 0];

/** What a message can say. */
export const MESSAGE_TEXT_CHOICES: MessageTextChoice[] = ["typeOnly", "typeAndName", "name", "custom"];

function pickChoice<T>(value: T | undefined, choices: T[]): T | undefined {
    return value !== undefined && choices.includes(value) ? value : undefined;
}

/** A saved When that the type has; undefined for any other (the type of a spell look not known: none). */
function repairWhen(when: unknown, reminderType: ReminderType | undefined): When | undefined {
    return reminderType !== undefined && listWhenChoices(reminderType).includes(when as When) ? (when as When) : undefined;
}

/** The part of a saved look that can be used: a sound that is no longer in the list, or a color that is no color, is dropped. */
function repairStyle(style: StyleOverride | undefined, reminderType: ReminderType | undefined): StyleOverride | undefined {
    if (style === undefined || type(style) !== "table") return undefined;
    const repaired: StyleOverride = {};
    repaired.when = repairWhen(style.when, reminderType);
    if (isSoundKey(style.sound)) repaired.sound = style.sound;
    if (type(style.isMessageOn) === "boolean") repaired.isMessageOn = style.isMessageOn;
    repaired.repeat = pickChoice(style.repeat, REPEAT_CHOICES);
    repaired.glowTime = pickChoice(style.glowTime, GLOW_TIME_CHOICES);
    repaired.animation = pickChoice(style.animation, ANIMATION_CHOICES);
    const glowPercent = tonumber(style.glowPercent);
    if (glowPercent !== undefined) repaired.glowPercent = math.max(1, math.min(100, math.floor(glowPercent + 0.5)));
    repaired.messageTextChoice = pickChoice(style.messageTextChoice, MESSAGE_TEXT_CHOICES);
    repaired.messageShowFor = pickChoice(style.messageShowFor, MESSAGE_SHOW_FOR_CHOICES);
    repaired.color = repairColor(style.color);
    repaired.messageColor = repairColor(style.messageColor);
    if (type(style.messageText) === "string" && style.messageText !== "") repaired.messageText = style.messageText;
    return repaired;
}

function repairColor(color: StyleOverride["color"]): StyleOverride["color"] {
    return color !== undefined && type(color) === "table" && tonumber(color[0]) !== undefined
        ? [color[0], color[1] ?? 0, color[2] ?? 0]
        : undefined;
}

/** A limit of how few is running low: any number from 0. */
function repairLimit(limit: unknown, byDefault: number): number {
    return type(limit) === "number" && (limit as number) >= 0 ? (limit as number) : byDefault;
}

/** The folders that make sense; there is always one to fill in. */
function repairSoundFolders(saved: unknown, byDefault: AddonSettings["customSoundFolders"]): AddonSettings["customSoundFolders"] {
    if (type(saved) !== "table") return byDefault;
    const folders = (saved as AddonSettings["customSoundFolders"])
        .filter(
            (entry) =>
                type(entry) === "table" && type(entry.folder) === "string" && string.find(entry.folder, "^[^\\/:]+$")[0] !== undefined,
        )
        .map((entry) => ({ folder: entry.folder, count: repairLimit(entry.count, 0) }));
    return folders.length > 0 ? folders : byDefault;
}

/**
 * Tracked Bars used to go with Tracked Buffs: on its own now, it starts as Tracked Buffs was, so nothing changes on the screen.
 * It never glowed, and starts not glowing.
 */
function splitTrackedBars(values: AddonSettings): void {
    if (values.isTrackedBarsSplit) return;
    values.isTrackedBarsSplit = true;
    values.trackedBarsIcons = values.trackedBuffsIcons;
    values.barsThatGlow = { ...values.barsThatGlow, trackedBars: false };
}

/** Puts right what a saved look got wrong. */
export function repairSettings(values: AddonSettings): void {
    // Whatever goes wrong with old settings, the addon still loads: what was not converted is the default
    tryCall(() => convertOldSettings(values));
    splitTrackedBars(values);
    // A style no longer known (or circling on a round button) is the default again
    const defaults = createDefaultSettings();
    if (!["breathing", "none"].includes(values.roundAnimation)) values.roundAnimation = defaults.roundAnimation;
    if (!FADED_OPACITY_CHOICES.includes(values.fadedOpacity)) values.fadedOpacity = defaults.fadedOpacity;
    // An added spell that is not a number and a type is dropped
    values.addedSpells = (values.addedSpells ?? []).filter(
        (cue) => type(cue) === "table" && tonumber(cue.id) !== undefined && ADDABLE_TYPES.includes(cue.reminderType),
    );
    values.reagentBelow = repairLimit(values.reagentBelow, defaults.reagentBelow);
    values.stockBelow = repairLimit(values.stockBelow, defaults.stockBelow);
    values.customSoundFolders = repairSoundFolders(values.customSoundFolders, defaults.customSoundFolders);
    // The old switch of a Greater Blessing for one member of a class in a party is a party group version from one
    const old = values as { showGreaterForOne?: boolean };
    if (old.showGreaterForOne === true) values.partyGroupFrom = 1;
    old.showGreaterForOne = undefined;
    if (!GROUP_FROM_CHOICES.includes(values.partyGroupFrom)) values.partyGroupFrom = defaults.partyGroupFrom;
    if (!GROUP_FROM_CHOICES.includes(values.raidGroupFrom)) values.raidGroupFrom = defaults.raidGroupFrom;
    for (const reminderType of TYPE_ORDER) values.styles[reminderType] = repairStyle(values.styles[reminderType], reminderType);
    // A spell's look is kept under its type and name ("buff:Arcane Intellect")
    for (const [key, style] of pairs(values.spellStyles)) {
        const [reminderType] = string.match(key as string, "^(%a+):");
        values.spellStyles[key as string] = repairStyle(
            style,
            TYPE_ORDER.find((known) => known === reminderType),
        );
    }
}
