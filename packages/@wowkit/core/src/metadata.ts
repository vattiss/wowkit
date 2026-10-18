// What the decorators write down. Addon.start reads it; nothing here runs the addon.
/** What a method listens to. */
export interface ListenerSpec {
    kind: "game" | "unit" | "event" | "interval";
    /** The game event, or the name of the addon's own event. */
    name?: string;
    /** For "interval": how often, in seconds. */
    seconds?: number;
    /** The method that handles it. */
    method: string;
}

/** Class prototype -> what its methods listen to. */
export const listeners = new LuaMap<object, ListenerSpec[]>();

export function addListener(prototype: object, spec: ListenerSpec): void {
    const list = listeners.get(prototype) ?? [];
    list.push(spec);
    listeners.set(prototype, list);
}
