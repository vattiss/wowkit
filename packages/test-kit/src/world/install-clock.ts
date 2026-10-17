// Time: the game's clock and timers, driven by the test.
import type { FakeClock } from "./clock";
import { defineGlobals, defineNamespace } from "./define";

export function installClock(clock: FakeClock): void {
    defineGlobals({
        GetTime: () => clock.getNow(),
        GetServerTime: () => math.floor(clock.getNow()),
    });
    defineNamespace<typeof C_Timer>("C_Timer", {
        After: (seconds, callback) => clock.after(seconds, callback),
        NewTicker: (seconds, callback) => clock.newTicker(seconds, callback),
    });
}
