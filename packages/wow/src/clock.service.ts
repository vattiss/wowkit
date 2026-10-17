// Time and timers.

export interface RepeatingTimer {
    stop: (this: void) => void;
}

export class ClockService {
    /** Seconds on the game's clock (with fractions); only differences between two readings mean something. */
    getCurrentTime(): number {
        return GetTime();
    }

    /** Runs `action` once after `seconds`; 0 runs it on the next frame. */
    runAfter(seconds: number, action: (this: void) => void): void {
        C_Timer.After(seconds, action);
    }

    /** Runs `action` every `seconds` until the timer is stopped. */
    runEvery(seconds: number, action: (this: void) => void): RepeatingTimer {
        const ticker = C_Timer.NewTicker(seconds, action);
        return { stop: () => ticker.Cancel() };
    }
}
