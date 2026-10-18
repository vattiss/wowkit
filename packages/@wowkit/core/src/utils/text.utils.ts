// Text helpers any code may use. The name formats of spells, auras and action buttons belong to the code that
// compares those names.

/** The text without leading and trailing white space. */
export function trimText(text: string): string {
    const [trimmed] = string.match(text, "^%s*(.-)%s*$");
    return trimmed ?? "";
}

/** Plain-text search (no Lua patterns). */
export function contains(text: string, token: string): boolean {
    return string.find(text, token, 1, true)[0] !== undefined;
}
