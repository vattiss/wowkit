// Puts the fake game's functions where the addon looks for the real ones. The types come from the
// real API (types/), so a fake whose signature drifts from the game's does not compile.
const globals = _G as unknown as Record<string, unknown>;

/** Sets global functions of the game (GetTime, UnitClass...). */
export function defineGlobals(functions: Partial<typeof globalThis>): void {
    for (const [name, value] of pairs(functions)) globals[name as string] = value;
}

/** Sets members of a namespace of the game (C_Spell, C_Timer...); only the ones the addon uses are needed. */
export function defineNamespace<T extends object>(name: string, members: Partial<T>): void {
    globals[name] = members;
}

/** Sets global values that have no useful type of their own (frames, constant tables). */
export function defineValues(values: Record<string, unknown>): void {
    for (const [name, value] of pairs(values)) globals[name as string] = value;
}

/** Removes a global, as if the game never set it (a character without saved data). */
export function clearGlobal(name: string): void {
    globals[name] = undefined;
}

/** Reads a global value of the running game. */
export function readGlobal(name: string): unknown {
    return globals[name];
}

/** A big game structure with only the fields the addon reads, checked for the names and types given. */
export function fake<T>(fields: Partial<T>): T {
    return fields as T;
}
