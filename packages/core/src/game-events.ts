// The game's events and timers, on one hidden frame. The core's decorators and lifecycle sit
// on this; services never call it (they use @OnGameEvent, @OnUnitEvent and @Interval).
type Handler = (this: void, ...payload: unknown[]) => void;

let eventFrame: Frame | undefined;
const handlers: { [event: string]: Handler[] | undefined } = {};

function getEventFrame(): Frame {
    if (eventFrame) return eventFrame;
    eventFrame = CreateFrame("Frame");
    eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => {
        const list = handlers[event];
        if (list === undefined) return;
        // Copy so handlers may unsubscribe while the event is dispatched
        for (const handler of [...list]) handler(...payload);
    });
    return eventFrame;
}

function subscribe(event: WowEvent, handler: Handler, register: (this: void) => void): () => void {
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
            getEventFrame().UnregisterEvent(event);
        }
    };
}

/** Subscribes to a game event; returns a function that unsubscribes. */
export function listenToGameEvent(event: WowEvent, handler: Handler): () => void {
    return subscribe(event, handler, () => getEventFrame().RegisterEvent(event));
}

/**
 * Subscribes to a unit event for the player only (not every nameplate and party member).
 * One event should use either listenToGameEvent or listenToUnitEvent, not both.
 */
export function listenToUnitEvent(event: WowEvent, handler: Handler): () => void {
    return subscribe(event, handler, () => getEventFrame().RegisterUnitEvent(event, "player"));
}

/** Runs `action` every `seconds` until the returned function is called. */
export function runInterval(seconds: number, action: (this: void) => void): () => void {
    const ticker = C_Timer.NewTicker(seconds, action);
    return () => ticker.Cancel();
}
