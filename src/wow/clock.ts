// Time and timers.

/** Seconds on the game's clock (with fractions); only differences between two readings mean something. */
export function getCurrentTime(): number {
    return GetTime();
}

/** Runs `action` once after `seconds`; 0 runs it on the next frame. */
export function runAfter(seconds: number, action: (this: void) => void): void {
    C_Timer.After(seconds, action);
}

export interface RepeatingTimer {
    stop: (this: void) => void;
}

/** Runs `action` every `seconds` until the timer is stopped. */
export function runEvery(seconds: number, action: (this: void) => void): RepeatingTimer {
    const ticker = C_Timer.NewTicker(seconds, action);
    return { stop: () => ticker.Cancel() };
}
