// Time and timers.

export class ClockService {
    /** Seconds on the game's clock (with fractions); only differences between two readings mean something. */
    getCurrentTime(): number {
        return GetTime();
    }

    /** Runs `action` once after `seconds`; 0 runs it on the next frame. */
    runAfter(seconds: number, action: (this: void) => void): void {
        C_Timer.After(seconds, action);
    }
}
