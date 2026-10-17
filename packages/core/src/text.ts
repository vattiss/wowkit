// Text helpers. Names are compared in three slightly different normal forms, each for its own job.

/** The text without leading and trailing white space. */
function trimText(text: string): string {
    const [trimmed] = string.match(text, "^%s*(.-)%s*$");
    return trimmed ?? "";
}

/** Plain-text search (no Lua patterns). */
export function contains(text: string, token: string): boolean {
    return string.find(text, token, 1, true)[0] !== undefined;
}

/**
 * Aura matching: lowercase, every "(...)" removed, trimmed.
 * "Power Word: Fortitude (Rank 2)" -> "power word: fortitude"
 */
export function buildAuraKey(name: string): string {
    const [stripped] = string.gsub(string.lower(name), "%s*%([^%)]*%)", "");
    return trimText(stripped);
}

/**
 * Spellbook grouping: auraKey, without "Rank N", single-spaced, so every rank of a spell shares
 * one key. "Smite  Rank 3" -> "smite"
 */
export function buildSpellBookKey(name: string): string {
    let [key] = string.gsub(buildAuraKey(name), "%s*rank%s*%d+", "");
    [key] = string.gsub(key, "%s+", " ");
    return trimText(key);
}

/**
 * Action button matching: lowercase, only a trailing "(...)" removed, trimmed; undefined when
 * nothing is left. Names from macros keep inner parentheses.
 */
export function buildButtonKey(name: string): string | undefined {
    const [stripped] = string.gsub(name, "%s*%([^)]*%)%s*$", "");
    const key = trimText(string.lower(stripped));
    return key !== "" ? key : undefined;
}
