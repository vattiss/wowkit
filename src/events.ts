// Typed game-event subscriptions on top of a single hidden frame.
// Payload types come from types/generated/wow-events.d.ts.

type EventHandler<E extends WowEvent> = (this: void, ...payload: WowEventPayloads[E]) => void;
type AnyHandler = (this: void, ...payload: unknown[]) => void;

const eventFrame = CreateFrame("Frame");
const handlers: { [event: string]: AnyHandler[] | undefined } = {};

eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => {
    const list = handlers[event];
    if (list === undefined) return;
    // Copy so handlers may unsubscribe while the event is dispatched
    for (const handler of [...list]) handler(...payload);
});

function subscribe(event: WowEvent, handler: AnyHandler, register: (this: void) => void): () => void {
    let list = handlers[event];
    if (list === undefined) {
        list = [];
        handlers[event] = list;
        register();
    }
    list.push(handler);
    return () => {
        const current = handlers[event];
        if (current === undefined) return;
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
        if (current.length === 0) {
            handlers[event] = undefined;
            eventFrame.UnregisterEvent(event);
        }
    };
}

/** Subscribes to a game event; returns a function that unsubscribes. */
export function onEvent<E extends WowEvent>(event: E, handler: EventHandler<E>): () => void {
    return subscribe(event, handler as AnyHandler, () => eventFrame.RegisterEvent(event));
}

/**
 * Subscribes to a unit event for the player only (not every nameplate and party member).
 * One event should use either onEvent or onPlayerEvent, not both.
 */
export function onPlayerEvent<E extends WowEvent>(event: E, handler: EventHandler<E>): () => void {
    return subscribe(event, handler as AnyHandler, () => eventFrame.RegisterUnitEvent(event, "player"));
}
