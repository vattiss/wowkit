import type { CustomSoundFolder, ProfiledSettingsService, SoundKey } from "@wowkit/ui";
import type { ProcRule } from "../glows/proc-rules.interface";
import type { GlowAnimation, Rgb } from "@wowkit/wow";
import type { SavedBuffMemory } from "../character/buff-memory.snapshot";

/** The types of reminder. Each has a look (color, glow %, message, sound) the player can change for the type and for a spell. */
export type ReminderType =
    | "missingBuff"
    | "weaponBuff"
    | "missingSeal"
    | "missingTracking"
    | "missingDebuff"
    | "totemGone"
    | "readyCooldown"
    | "utilityCooldown"
    | "proc"
    | "oldRank"
    | "lowReagent"
    | "lowStock";

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = ProfiledSettingsService<AddonSettings>;

/**
 * When a reminder may show: always, only in combat or only out of it, only with a living enemy or anyone targeted or in a
 * fight, only with a living ally targeted; or (the low reagents and the low stock) glowing anywhere, with its message and
 * sound only in a town or an inn. A ready cooldown glows once, as it is ready while its When holds; its "+ start" choices
 * also as their time begins, when it is ready then: In combat + start ("inCombatStart") and Always + start ("alwaysStart")
 * as a fight starts, Out of combat + start ("outOfCombatStart") as it ends. The targeted ones have their start without a
 * choice: a target of their kind (or, for Enemy and Any targeted, a fight).
 */
export type When =
    | "always"
    | "alwaysStart"
    | "inCombat"
    | "inCombatStart"
    | "outOfCombat"
    | "outOfCombatStart"
    | "enemyTargeted"
    | "allyTargeted"
    | "anyTargeted"
    | "townAlert";

/** What a message says: the type of reminder, the type and the spell or item, the spell or item, or the player's own words. */
export type MessageTextChoice = "typeOnly" | "typeAndName" | "name" | "custom";

/** How a reminder looks and sounds, and when it shows. */
export interface Style {
    /** Of the glow and of the message. */
    color: Rgb;
    /** The glow %, 1 to 100. */
    glowPercent: number;
    /** Does a short message at the top of the screen say so? */
    isMessageOn: boolean;
    sound: SoundKey;
    /** Seconds between the repeats of the glow, the message and the sound; 0 shows them once, as the reminder starts. */
    repeat: number;
    when: When;
    /** Seconds the reminder shows once it is due, and again with each repeat; 0 = the whole time, until it is done. */
    glowTime: number;
    /** How the glow moves: around the button, breathing, or still (fading in and out only as it comes and goes). */
    animation: GlowAnimation;
    /** What the message says; none: what its type says by default (StyleService.getMessageTextChoice). */
    messageTextChoice?: MessageTextChoice;
    /** The player's own words for the message, for the Custom choice. */
    messageText?: string;
    /** The color of the message, where it is not the glow's. */
    messageColor?: Rgb;
    /** Seconds the message stays; 0: as long as the button glows; none: the usual time (NOTICE_SECONDS). */
    messageShowFor?: number;
    /**
     * Seconds before a buff, weapon buff, seal or debuff runs out that its reminder comes; 0: once it is gone. Other types have none.
     */
    before?: number;
}

/** The types a spell can be added as by the player: every type but the old ranks, which are found for every spell. */
export type AddableType =
    | "missingBuff"
    | "weaponBuff"
    | "missingSeal"
    | "missingTracking"
    | "missingDebuff"
    | "lowReagent"
    | "readyCooldown"
    | "utilityCooldown"
    | "proc"
    | "lowStock";

/** The tabs of the table of looks (TABLE_TABS). */
export type TableTab = "buffs" | "cooldowns" | "procRules" | "procs" | "consumables" | "oldRanks" | "sounds" | "help";

/** The types of a cooldown that glows as it is ready: the ones of a fight, and the ones of between fights (a herb, a fall). */
export type CooldownType = "readyCooldown" | "utilityCooldown";

/** A spell the player added by its ID; for the low stock an item, by its item ID. */
export interface AddedSpell {
    id: number;
    reminderType: AddableType;
}

/** The parts of a look the player changed; the rest is inherited. */
export type StyleOverride = Partial<Style>;

/** Add what the addon needs, only read what is there, or leave it alone. */
export type CooldownManagerAccess = "full" | "readOnly" | "off";
export type CooldownManagerIcons = "hide" | "show";

export interface AddonSettings {
    isDisabled: boolean;
    /** How big the messages at the top of the screen are, in percent. */
    messageSize: number;
    /** How far below the top of the screen the messages are, in pixels. */
    messageTop: number;
    /** Do the messages grow into place as they appear? */
    isMessageZoomInOn: boolean;
    /** Do the messages shrink away as they disappear? */
    isMessageZoomOutOn: boolean;
    /** Do the messages keep fading a little and back while they are on screen? */
    isMessageFadePulseOn: boolean;
    /** Do the messages keep growing and shrinking while they are on screen? */
    isMessageSizePulseOn: boolean;
    /** How fast and how strong the pulses of the messages are, in percent. */
    messagePulseSpeed: number;
    /** Do all the messages of one type share a line? */
    isOneLinePerType: boolean;
    /** Does the greeting in the chat come at each login? */
    shouldShowGreeting: boolean;
    /** A line in the chat when a buff the player cast on themselves is an older rank than they know? */
    shouldNoteOwnOlderRankBuffs: boolean;
    /** The same for a buff another player gave them. */
    shouldNoteOthersOlderRankBuffs: boolean;
    /** A line in the chat when a buff is cast where the game keeps it secret, and how long it lasts is not known yet? */
    shouldNoteHiddenBuffs: boolean;
    shouldStayQuietInTowns: boolean;
    /** Has this character seen the welcome window? */
    isWelcomeDone: boolean;
    /** The Welcome tab showed the choice about Blizzard's Cooldown Manager. */
    isCooldownChoiceSeen: boolean;
    /** How far the addon may use Blizzard's Cooldown Manager. */
    cooldownManagerAccess: CooldownManagerAccess;
    /** Are the icons of the manager kept out of sight? */
    trackedBuffsIcons: CooldownManagerIcons;
    trackedBarsIcons: CooldownManagerIcons;
    /** Has Tracked Bars got its own setting, started from Tracked Buffs (see repairSettings)? */
    isTrackedBarsSplit: boolean;
    essentialIcons: CooldownManagerIcons;
    utilityIcons: CooldownManagerIcons;
    /** Has the first choice for this character been made? */
    isCooldownManagerSetUp: boolean;
    /** Did the addon turn the manager on here? Then leaving it alone turns it off again. */
    isCooldownManagerOurs: boolean;
    /** Do the action buttons light up in rainbow colors while the player is AFK? */
    isAfkRainbowOn: boolean;
    /** Do macro buttons glow too, not only the buttons of spells and items? */
    shouldGlowOnMacros: boolean;
    /** Do macros with #showtooltip or #show glow for every spell they cast, not only the one they show? */
    shouldGlowOnEveryMacroSpell: boolean;
    /** What a circling glow does on a round button (Forever's gamepad bars, another addon's), where it cannot circle. */
    roundAnimation: GlowAnimation;
    /** Do ConsolePort's crossbar buttons get the round glow, as the round buttons do? */
    areConsolePortButtonsRound: boolean;
    isMissingBuffEnabled: boolean;
    isWeaponBuffEnabled: boolean;
    /** Party members missing the player's buffs. */
    showPartyBuffs: boolean;
    /** Raid members missing the player's buffs. */
    showRaidBuffs: boolean;
    /** Does a message list the members missing the player's buff, in a party or a raid, whatever the table's Message says? */
    showPartyBuffMessage: boolean;
    showRaidBuffMessage: boolean;
    /**
     * The group version (Prayer of Fortitude, a Greater Blessing) is asked for from this many missing the buff, the player
     * counted (1 to 5): in a party, and in a raid. A Greater Blessing counts the members of its class.
     */
    partyGroupFrom: number;
    raidGroupFrom: number;
    /** Spells on the bars at a lower rank than the one the player knows. */
    isOldRankEnabled: boolean;
    /** The reagents of the group buffs running low, on arriving in a town. */
    isLowReagentEnabled: boolean;
    /** Important cooldowns that are ready. */
    isReadyCooldownEnabled: boolean;
    /** Cooldowns of between fights that are ready (a herb, a fall, a run). */
    isUtilityCooldownEnabled: boolean;
    /** Have the looks the player set for them as ready cooldowns moved to their own type (UtilityLooksService)? */
    areUtilityLooksMoved: boolean;
    /** The utility cooldowns whose ready cooldown looks and added spells were moved to their type, by spell ID (each once). */
    movedUtilityCooldowns: { [spellId: string]: boolean | undefined };
    /** Have the switch, limit and look of each reagent's row moved to the rows of its spells (ReagentRowsService)? */
    areReagentRowsSplit: boolean;
    /** Have the look and switch of a defensive at low health moved to its own row (LowHealthRowsService)? */
    areLowHealthRowsMoved: boolean;
    /** A group buff's reagent runs low with fewer than this in the bags. */
    reagentBelow: number;
    /** The same of the items the player watches, and whether they are watched. */
    stockBelow: number;
    isLowStockEnabled: boolean;
    /** The limit of a row of its own ("stock:2512", "reagent:17028"), where it has one. */
    belowLimits: { [entry: string]: number | undefined };
    /** How long each buff lasts, as learned from its aura (by its name key): one cast where it is kept secret is followed to its end. */
    buffDurations: { [buffKey: string]: number | undefined };
    /** The buff memory as it was at the last logout, taken back after a /reload (BuffMemorySaveService). */
    buffMemory: SavedBuffMemory | undefined;
    /** Spells the game says are usable now (Overpower, Revenge, Execute...). */
    isProcEnabled: boolean;
    /** The procs go by the proc rules (beta), a new engine, instead of the built-in one. */
    shouldUseProcRules: boolean;
    /** The proc rules the player added. */
    procRules: ProcRule[];
    /** The built-in proc rules the player switched off, by their key ("20271:targetType:6"). */
    disabledProcRules: { [ruleKey: string]: boolean | undefined };
    /** A paladin in a fight with no seal up. */
    isMissingSealEnabled: boolean;
    /** A miner or a herbalist with no tracking on. */
    isMissingTrackingEnabled: boolean;
    /** A debuff of the player's, added by its ID, missing on the target in a fight (Serpent Sting, Hunter's Mark). */
    isMissingDebuffEnabled: boolean;
    /** How long each debuff of the player's lasts, as learned from its aura on a target (by its name key). */
    debuffDurations: { [debuffKey: string]: number | undefined };
    /** A shaman's totem that is gone (killed, run out): the one dropped last in its element glows. */
    isTotemGoneEnabled: boolean;
    /** The totem the shaman dropped last in each slot (1 fire, 2 earth, 3 water, 4 air), kept across logins. */
    lastTotems: { [slot: string]: number | undefined };
    /** The player's changes to the look of each type of reminder (the default look of its spells). */
    styles: { [key in ReminderType]?: StyleOverride };
    /** The player's changes to the look of one spell in one type, by the type and the spell's name ("rank:Smite"). */
    spellStyles: { [typeAndName: string]: StyleOverride | undefined };
    /** The player's fix of the ID of a cooldown or proc of the lists (by the list's ID): the ID the client knows it by. */
    idOverrides: { [listId: string]: number | undefined };
    /** Cooldowns and procs the player added by their ID. */
    addedSpells: AddedSpell[];
    /** The action bars (1 to 8) whose buttons are faded until they glow; only set where the player switched one on. */
    fadedBars: { [bar: string]: boolean | undefined };
    /** How visible the buttons of a faded bar are while they do not glow, in percent. */
    fadedOpacity: number;
    /** The spell IDs in the spell and item tooltips, to add a spell by its ID in the table. */
    showTooltipIds: boolean;
    /** The table shows every column (Advanced), not only the ones everybody needs (Basic). */
    isTableAdvanced: boolean;
    /** The tab the table of looks opens on: the one it was on. */
    tableTab: TableTab;
    /** The tabs of the table that list the spells not learned yet too (Show unlearned spells); by default none does. */
    shownUnlearned: { [tab in TableTab]?: boolean };
    /** The folders in AddOns with sound files of the player's own (custom1, custom2...), and how many each has. */
    customSoundFolders: CustomSoundFolder[];
    /** The action bars (1 to 8) that glow; only set (false) where the player switched one off. */
    barsThatGlow: { [bar: string]: boolean | undefined };
    /** Per-spell switches of the cooldown and proc glows (by spell ID); only set where the player switched one off. */
    enabledSpells: { [spellId: string]: boolean | undefined };
    /** The buff of a group (one aura, one armor) the player cast last, by the group's first spell ID: the one that glows. */
    lastBuffs: { [group: string]: number | undefined };
    /** The Well Fed each food or drink the player added gives, as learned when it was used (spell ID -> the aura's spell ID). */
    fedBuffs: { [spell: string]: number | undefined };
    /** The item of each food or drink the player added, as seen on a button (spell ID -> item ID). */
    fedItems: { [spell: string]: number | undefined };
    /** The spells whose old rank is not reminded of, by name; only set where the player switched one off. */
    enabledRanks: { [spellName: string]: boolean | undefined };
    /** Per-reagent switches (by item ID); only set where the player switched one off. */
    enabledReagents: { [itemId: string]: boolean | undefined };
    /** Per-buff switches; only set where the player changed the default. */
    enabledBuffs: { [buffKey: string]: boolean | undefined };
    /** Weapon buff picks (WeaponBuff.key); undefined = automatic. */
    weaponBuff?: string;
    weaponBuffOff?: string;
}
