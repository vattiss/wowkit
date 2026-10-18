// The game's clock and timers. Time only moves when a test calls advance().

interface PendingTimer {
    at: number;
    run: () => void;
}

interface PendingTicker {
    interval: number;
    nextAt: number;
    /** Shared with the handle the addon holds, so cancelling it stops this ticker. */
    cancellation: { isCancelled: boolean };
    run: (ticker: TimerHandle) => void;
    handle: TimerHandle;
}

export interface FakeClock {
    getNow(): number;
    after(seconds: number, run: () => void): void;
    newTicker(seconds: number, run: (ticker: TimerHandle) => void): TimerHandle;
    /** Moves the clock forward in small steps, running the timers and tickers that come due. */
    advance(seconds: number): void;
}

const STEP = 0.05;

export function createClock(startAt = 1000): FakeClock {
    let now = startAt;
    const timers: PendingTimer[] = [];
    const tickers: PendingTicker[] = [];

    /** Runs the timers that are due now. A timer set by one of them waits for the next step, as it does for the next frame. */
    function runDueTimers(): void {
        const due = timers.filter((timer) => timer.at <= now);
        for (const timer of due) timers.splice(timers.indexOf(timer), 1);
        for (const timer of due) timer.run();
    }

    return {
        getNow() {
            return now;
        },
        after(seconds, run) {
            timers.push({ at: now + seconds, run });
        },
        newTicker(seconds, run) {
            const cancellation = { isCancelled: false };
            const handle: TimerHandle = {
                Cancel() {
                    cancellation.isCancelled = true;
                },
                IsCancelled() {
                    return cancellation.isCancelled;
                },
            };
            tickers.push({ interval: seconds, nextAt: now + seconds, cancellation, run, handle });
            return handle;
        },
        advance(seconds) {
            const target = now + seconds;
            while (now < target) {
                now = math.min(now + STEP, target);
                runDueTimers();
                for (const ticker of tickers) {
                    if (!ticker.cancellation.isCancelled && ticker.nextAt <= now) {
                        ticker.nextAt = now + ticker.interval;
                        ticker.run(ticker.handle);
                    }
                }
            }
        },
    };
}
