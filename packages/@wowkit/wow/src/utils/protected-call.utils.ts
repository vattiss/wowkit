// Protected calls: client functions can raise errors on odd input or state. The addon calls them in protected mode
// and carries on.

/** Calls `fn` in protected mode: whether it succeeded, and its result. */
export function tryCall<A extends unknown[], R>(
    fn: (this: void, ...args: A) => R,
    ...args: A
): LuaMultiReturn<[didSucceed: boolean, result: R | undefined]> {
    const [didSucceed, result] = pcall(fn, ...args);
    if (!didSucceed) return $multi(false, undefined);
    return $multi(true, result as R);
}

/** Calls `fn` in protected mode: its result, or undefined when it raised an error. */
export function attempt<A extends unknown[], R>(fn: (this: void, ...args: A) => R, ...args: A): R | undefined {
    const [, result] = tryCall(fn, ...args);
    return result;
}

/** `attempt` for functions with several results: ok, then the results (all nil on error). */
export function attemptMulti<R extends unknown[]>(
    fn: (this: void) => LuaMultiReturn<R>,
): LuaMultiReturn<[didSucceed: boolean, ...results: Partial<R>]> {
    return pcall(fn) as unknown as LuaMultiReturn<[didSucceed: boolean, ...results: Partial<R>]>;
}
