// How spell, aura and item names are compared. The client writes "(Rank 2)" or "(Cat)" after some names, the same spell is
// one name in every rank, and a localized client may spell one name two ways (Plaie d'agonie and Plaie d’agonie, with
// another apostrophe). So names are compared by a key of their letters alone: lower case, every "(...)" and "Rank N"
// removed, and no punctuation, space or digit left. Letters beyond the English ones (é, or a Russian client's) stay: one
// client always writes them alike, and a name of no English letter must not come out empty.
import { trimText } from "@wowkit/core";

/**
 * The punctuation of other scripts a client may write in a name: the apostrophes, quotes, dashes and spaces of typography,
 * and the full-width marks of a Chinese, Japanese or Korean client (its space, colon, commas, middle dot, brackets).
 */
const TYPOGRAPHIC_MARKS = [
    "’",
    "‘",
    "‚",
    "‛",
    "“",
    "”",
    "„",
    "‐",
    "‑",
    "‒",
    "–",
    "—",
    "−",
    "…",
    "«",
    "»",
    " ",
    "·",
    "　",
    "：",
    "，",
    "、",
    "。",
    "．",
    "・",
    "－",
    "「",
    "」",
    "『",
    "』",
    "（",
    "）",
];

/** Any byte past ASCII: only a text with one may hold a mark of typography (made of bytes, as Lua's patterns are). */
const BEYOND_ASCII = `[${string.char(128)}-${string.char(255)}]`;
/** How many name keys are kept at most: names are many but not endless (spells, auras, items); past it they are made anew. */
const MOST_KEPT_KEYS = 4000;

/** The keys made so far, by name: a key is asked for at every look at an aura, and made of many replacements. */
let keptKeys = new LuaMap<string, string>();
let keptCount = 0;

/** The letters of a text alone, in lower case: every ASCII character but a to z, and the marks of typography, removed. */
export function buildLetterKey(text: string): string {
    let key = string.lower(text);
    // A text of plain ASCII (most names) has none of the marks: they are looked for only past it
    if (string.find(key, BEYOND_ASCII)[0] !== undefined) for (const mark of TYPOGRAPHIC_MARKS) [key] = string.gsub(key, mark, "");
    [key] = string.gsub(key, "[%z\u0001-`{-\u007f]", "");
    return key;
}

/**
 * "Power Word: Fortitude (Rank 2)" -> "powerwordfortitude"; "Plaie d’agonie" -> "plaiedagonie". A name of no letter ("1719", a
 * spell named by its ID) is its own key, so two of them stay apart; empty only for an empty name.
 */
export function buildNameKey(name: string): string {
    const kept = keptKeys.get(name);
    if (kept !== undefined) return kept;
    const key = makeNameKey(name);
    if (keptCount >= MOST_KEPT_KEYS) {
        keptKeys = new LuaMap();
        keptCount = 0;
    }
    keptKeys.set(name, key);
    keptCount += 1;
    return key;
}

function makeNameKey(name: string): string {
    let [stripped] = string.gsub(string.lower(name), "%([^%)]*%)", "");
    // What a Chinese or Japanese client writes in full-width brackets: "（等级 2）"
    [stripped] = string.gsub(stripped, "（.-）", "");
    [stripped] = string.gsub(stripped, "rank%s*%d+", "");
    const key = buildLetterKey(stripped);
    return key !== "" ? key : trimText(string.lower(name));
}

/** Are these two names of one spell, aura or item, as the client may write them? False when either is missing or empty. */
export function isSameName(first: string | undefined, second: string | undefined): boolean {
    if (first === undefined || second === undefined) return false;
    const key = buildNameKey(first);
    return key !== "" && key === buildNameKey(second);
}

/** Does the text (a tooltip's line) name this, however the two are written? False for an empty name. */
export function doesTextName(text: string, name: string): boolean {
    const key = buildLetterKey(name);
    return key !== "" && string.find(buildLetterKey(text), key, 1, true)[0] !== undefined;
}
