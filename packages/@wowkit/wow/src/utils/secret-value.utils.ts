// Secret values: in combat (and for some units) the client hands out values addon code may not read, compare or do
// math with; doing so raises an error, so values are checked before use.

/** A value addon code may look at: not nil, not secret, and accessible from this code. */
export function isReadable(value: unknown): boolean {
    // Comparing with nil is allowed on secret values; anything else is not
    if (value === undefined) return false;
    if (issecretvalue(value)) return false;
    return canaccessvalue(value);
}

/** The value when readable, else undefined. */
export function getReadable<T>(value: T | undefined): T | undefined {
    return isReadable(value) ? value : undefined;
}

/** A readable positive number (spell, item or texture ID), else undefined. */
export function getReadableId(value: unknown): number | undefined {
    if (!isReadable(value) || value === 0 || value === "") return undefined;
    const n = tonumber(value);
    return n !== undefined && n > 0 ? n : undefined;
}
