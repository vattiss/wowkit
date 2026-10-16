// A minimal publish/subscribe hook. Modules use it to notify each other without importing each
// other: TypeScriptToLua bundles modules with `require`, which does not support import cycles.

export interface Signal<A extends unknown[]> {
    listen(listener: (this: void, ...args: A) => void): void;
    emit(...args: A): void;
}

export function createSignal<A extends unknown[] = []>(): Signal<A> {
    const listeners: ((this: void, ...args: A) => void)[] = [];
    return {
        listen: (listener) => {
            listeners.push(listener);
        },
        emit: (...args) => {
            for (const listener of listeners) listener(...args);
        },
    };
}
