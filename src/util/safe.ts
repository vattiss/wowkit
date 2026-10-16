// Calling the client safely.
//
// Secret values: in combat (and for some units) the client hands out values addon code may not
// read, compare or do math with; doing so raises an error, so values are checked before use.
//
// Protected calls: client functions can raise errors on odd input or state. The addon calls them
// in protected mode and carries on; every error swallowed that way is reported through
// `swallowedError`, so the debug report can count them instead of hiding our own bugs.
import { createSignal } from "./signal";

/** An error a protected call swallowed. */
export const swallowedError = createSignal<[message: string]>();

/** A value addon code may look at: not nil, not secret, and accessible from this code. */
export function readable(value: unknown): boolean {
    // Comparing with nil is allowed on secret values; anything else is not
    if (value === undefined) return false;
    if (issecretvalue(value)) return false;
    return canaccessvalue(value);
}

/** The value when readable, else undefined. */
export function safe<T>(value: T | undefined): T | undefined {
    return readable(value) ? value : undefined;
}

/** A readable positive number (spell, item or texture ID), else undefined. */
export function plainId(value: unknown): number | undefined {
    if (!readable(value) || value === 0 || value === "") return undefined;
    const n = tonumber(value);
    return n !== undefined && n > 0 ? n : undefined;
}

function reportError(this: void, error: unknown): unknown {
    swallowedError.emit(tostring(error));
    return error;
}

/** Calls `fn` in protected mode: whether it succeeded, and its result. */
export function tryCall<A extends unknown[], R>(fn: (this: void, ...args: A) => R, ...args: A): LuaMultiReturn<[ok: boolean, result: R | undefined]> {
    const [ok, result] = pcall(fn, ...args);
    if (!ok) {
        reportError(result);
        return $multi(false, undefined);
    }
    return $multi(true, result as R);
}

/** Calls `fn` in protected mode: its result, or undefined when it raised an error. */
export function attempt<A extends unknown[], R>(fn: (this: void, ...args: A) => R, ...args: A): R | undefined {
    const [, result] = tryCall(fn, ...args);
    return result;
}

/** `attempt` for functions with several results: ok, then the results (all nil on error). */
export function attemptMulti<R extends unknown[]>(fn: (this: void) => LuaMultiReturn<R>): LuaMultiReturn<[ok: boolean, ...results: Partial<R>]> {
    return xpcall(fn, reportError) as unknown as LuaMultiReturn<[ok: boolean, ...results: Partial<R>]>;
}
