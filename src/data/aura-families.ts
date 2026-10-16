// Buff families: any member counts for the whole family. Some are exclusive (one aspect, one
// armor), others pair a buff with its group version (Prayer of Fortitude counts as Fortitude).
// Matched by name: the client often hides the aura ID in combat, and names survive remapped IDs.
import { auraKey, contains } from "../util/text";

export interface AuraFamily {
    key: string;
    /** Lowercase text found in the aura names of the family. */
    tokens: string[];
    /** How long a seen or cast member counts as up while auras are hidden. */
    seconds: number;
}

const AURA_FAMILIES: AuraFamily[] = [
    { key: "blessing", tokens: ["blessing"], seconds: 300 },
    {
        key: "palaura",
        tokens: ["devotion aura", "retribution aura", "concentration aura", "sanctity aura", "resistance aura"],
        seconds: 1800,
    },
    { key: "aspect", tokens: ["aspect"], seconds: 1800 },
    { key: "magearmor", tokens: ["ice armor", "frost armor", "mage armor"], seconds: 1800 },
    { key: "lockarmor", tokens: ["demon skin", "demon armor"], seconds: 1800 },
    // A buff and its group version
    { key: "fortitude", tokens: ["power word: fortitude", "prayer of fortitude"], seconds: 1800 },
    { key: "spirit", tokens: ["divine spirit", "prayer of spirit"], seconds: 1800 },
    { key: "shadowprotection", tokens: ["shadow protection"], seconds: 600 },
    { key: "wild", tokens: ["mark of the wild", "gift of the wild"], seconds: 1800 },
    { key: "intellect", tokens: ["arcane intellect", "arcane brilliance"], seconds: 1800 },
];

export function familyOf(name: string | undefined): AuraFamily | undefined {
    if (name === undefined || name === "") return undefined;
    const key = auraKey(name);
    for (const family of AURA_FAMILIES) {
        for (const token of family.tokens) {
            if (contains(key, token)) return family;
        }
    }
    return undefined;
}
