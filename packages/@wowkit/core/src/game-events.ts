// The game's events and timers, on one hidden frame per addon. The core's decorators and lifecycle sit
// on this; services never call it (they use @OnGameEvent, @OnUnitEvent and @Interval).
type Handler = (this: void, ...payload: unknown[]) => void;

export class GameEvents {
    private eventFrame: Frame | undefined;
    private readonly handlers: { [event: string]: Handler[] | undefined } = {};

    /** Subscribes to a game event; returns a function that unsubscribes. */
    listen(event: WowEvent, handler: Handler): () => void {
        return this.subscribe(event, handler, () => this.getEventFrame().RegisterEvent(event));
    }

    /**
     * Subscribes to a unit event for the player only (not every nameplate and party member).
     * One event should use either listen or listenToUnit, not both.
     */
    listenToUnit(event: WowEvent, handler: Handler): () => void {
        return this.subscribe(event, handler, () => this.getEventFrame().RegisterUnitEvent(event, "player"));
    }

    private getEventFrame(): Frame {
        if (this.eventFrame) return this.eventFrame;
        const frame = CreateFrame("Frame");
        frame.SetScript("OnEvent", (_frame, event, ...payload) => {
            const list = this.handlers[event];
            if (list === undefined) return;
            // Copy so handlers may unsubscribe while the event is dispatched
            for (const handler of [...list]) handler(...payload);
        });
        this.eventFrame = frame;
        return frame;
    }

    private subscribe(event: WowEvent, handler: Handler, register: (this: void) => void): () => void {
        let list = this.handlers[event];
        if (list === undefined) {
            list = [];
            this.handlers[event] = list;
            register();
        }
        list.push(handler);
        return () => {
            const current = this.handlers[event];
            if (current === undefined) return;
            const index = current.indexOf(handler);
            if (index >= 0) current.splice(index, 1);
            if (current.length === 0) {
                this.handlers[event] = undefined;
                this.getEventFrame().UnregisterEvent(event);
            }
        };
    }
}

/** Runs `action` every `seconds` until the returned function is called. */
export function runInterval(seconds: number, action: (this: void) => void): () => void {
    const ticker = C_Timer.NewTicker(seconds, action);
    return () => ticker.Cancel();
}
