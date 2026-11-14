// The types of reminder that glow, in the order they are drawn: the setting that switches each on, and its spells.
import type { ReminderType } from "../settings/settings.interface";
import type { Reminders } from "./tick.interface";

/** One type of reminder: the setting that switches it on, and the spells of the reminders that make it glow. */
export interface GlowType {
    category: ReminderType;
    isOnSetting:
        | "isMissingBuffEnabled"
        | "isWeaponBuffEnabled"
        | "isMissingSealEnabled"
        | "isMissingTrackingEnabled"
        | "isTotemGoneEnabled"
        | "isReadyCooldownEnabled"
        | "isProcEnabled"
        | "isOldRankEnabled"
        | "isLowReagentEnabled"
        | "isLowStockEnabled";
    /** Does it glow on the Cooldown Manager's icons too? A buff, a cooldown or a proc does; a rank or a reagent is the button's. */
    isOnIcons: boolean;
    /** Puts the spells of the type's reminders into `spells`, an empty list. */
    collectSpells: (this: void, reminders: Reminders, spells: number[]) => void;
}

export function pushAll(spells: number[], ids: number[]): void {
    for (const id of ids) spells.push(id);
}

export const TYPES: GlowType[] = [
    {
        category: "missingBuff",
        isOnSetting: "isMissingBuffEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.buffsToCast),
    },
    {
        category: "weaponBuff",
        isOnSetting: "isWeaponBuffEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => {
            if (reminders.weaponSpell !== undefined) spells.push(reminders.weaponSpell);
            pushAll(spells, reminders.addedWeaponSpells);
        },
    },
    {
        category: "missingSeal",
        isOnSetting: "isMissingSealEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.seals),
    },
    {
        category: "missingTracking",
        isOnSetting: "isMissingTrackingEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.trackings),
    },
    {
        category: "totemGone",
        isOnSetting: "isTotemGoneEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.totemsGone),
    },
    {
        category: "readyCooldown",
        isOnSetting: "isReadyCooldownEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.readyCooldowns),
    },
    {
        category: "proc",
        isOnSetting: "isProcEnabled",
        isOnIcons: true,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.procs),
    },
    {
        category: "oldRank",
        isOnSetting: "isOldRankEnabled",
        isOnIcons: false,
        collectSpells: (reminders, spells) => {
            for (const rank of reminders.outdatedRanks) spells.push(rank.id);
        },
    },
    {
        category: "lowReagent",
        isOnSetting: "isLowReagentEnabled",
        isOnIcons: false,
        collectSpells: (reminders, spells) => pushAll(spells, reminders.reagentSpells),
    },
    {
        category: "lowStock",
        isOnSetting: "isLowStockEnabled",
        isOnIcons: false,
        collectSpells: (reminders, spells) => {
            for (const stock of reminders.lowStock) spells.push(stock.key);
        },
    },
];
