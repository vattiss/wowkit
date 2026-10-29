// A value other addons can reach: a global of the game's Lua state (an addon's API).

/** Sets the global `name`; another addon reads it as `_G[name]`, or by its name. */
export function setGlobal(name: string, value: unknown): void {
    (_G as unknown as Record<string, unknown>)[name] = value;
}
