// The types of reminder in their orders: the one the add button goes through, and the one the tables list them in.
import type { AddableType, ReminderType } from "./settings.interface";

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
    "missingTotem",
    "lowReagent",
    "lowStock",
    "readyCooldown",
    "proc",
    "oldRank",
];
