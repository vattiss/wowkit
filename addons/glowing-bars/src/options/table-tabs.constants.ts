// The tabs of the table of looks: the types of reminder each one lists, the sounds of the player's own on a tab of their
// own, and a help on the columns. A tab with no type of this character's is left out.
import type { TextKey } from "../locale/texts.constants";
import type { ReminderType, TableTab } from "../settings/settings.interface";

/** A tab of the table: its words, and the types whose rows it lists (none: the sounds). */
export interface TableTabInfo {
    key: TableTab;
    text: TextKey;
    types: ReminderType[];
}

export const TABLE_TABS: TableTabInfo[] = [
    {
        key: "buffs",
        text: "TAB_TABLE_BUFFS",
        types: ["missingBuff", "weaponBuff", "missingSeal", "missingTracking", "missingDebuff", "totemGone"],
    },
    { key: "cooldowns", text: "TAB_TABLE_COOLDOWNS", types: ["readyCooldown", "utilityCooldown"] },
    { key: "procRules", text: "TAB_TABLE_PROC_RULES", types: [] },
    { key: "procs", text: "TAB_TABLE_PROCS", types: ["proc"] },
    { key: "consumables", text: "TAB_TABLE_CONSUMABLES", types: ["lowReagent", "lowStock"] },
    { key: "oldRanks", text: "TAB_TABLE_OLD_RANKS", types: ["oldRank"] },
    { key: "sounds", text: "TAB_TABLE_SOUNDS", types: [] },
    { key: "help", text: "TAB_TABLE_HELP", types: [] },
];
