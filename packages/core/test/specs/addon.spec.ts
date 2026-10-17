import {
    Addon,
    Interval,
    OnEvent,
    OnGameEvent,
    type OnAddonLoaded,
    type OnFirstLogin,
    type OnLogin,
    type OnLogout,
    type OnReady,
} from "@wowkit/core";
import { beforeEach, createBasicGame, describe, expect, it, type BasicGame } from "@wowkit/test-kit";

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        "test.pinged": [value: number];
    }
}

/** A service that writes down what happens to it. */
class Probe implements OnAddonLoaded, OnFirstLogin, OnLogin, OnReady, OnLogout {
    ticks = 0;

    constructor(
        private readonly name: string,
        private readonly log: string[],
    ) {}

    onAddonLoaded(): void {
        this.log.push(`${this.name}:loaded`);
    }
    onFirstLogin(): void {
        this.log.push(`${this.name}:firstLogin`);
    }
    onLogin(): void {
        this.log.push(`${this.name}:login`);
    }
    onReady(): void {
        this.log.push(`${this.name}:ready`);
    }
    onLogout(): void {
        this.log.push(`${this.name}:logout`);
    }

    @OnGameEvent("PLAYER_DEAD")
    noteDeath(): void {
        this.log.push(`${this.name}:dead`);
    }

    @OnGameEvent("UNIT_AURA")
    noteAura(unit: string): void {
        this.log.push(`${this.name}:aura ${unit}`);
    }

    @OnEvent("test.pinged")
    notePing(value: number): void {
        this.log.push(`${this.name}:ping ${value}`);
    }

    @Interval(200)
    countTick(): void {
        this.ticks += 1;
    }
}

describe("an addon", () => {
    let game!: BasicGame;
    let addon!: Addon;
    let log!: string[];
    let first!: Probe;
    let second!: Probe;

    beforeEach(() => {
        game = createBasicGame();
        log = [];
        addon = new Addon("MyAddon");
        first = addon.register(new Probe("A", log));
        second = addon.register(new Probe("B", log));
        addon.start();
    });

    it("gives back the service it registers", () => {
        expect(first).not.toBe(second);
    });

    describe("loading", () => {
        it("ignores the loading of another addon", () => {
            game.frames.fire("ADDON_LOADED", "SomethingElse");
            expect(log).toEqual([]);
        });

        it("runs onAddonLoaded in the order the services were registered, once", () => {
            game.frames.fire("ADDON_LOADED", "MyAddon");
            game.frames.fire("ADDON_LOADED", "MyAddon");
            expect(log).toEqual(["A:loaded", "B:loaded"]);
        });
    });

    describe("logging in", () => {
        beforeEach(() => {
            game.frames.fire("PLAYER_LOGIN");
        });

        it("runs the hooks in their order, each service in turn", () => {
            expect(log).toEqual(["A:firstLogin", "B:firstLogin", "A:login", "B:login", "A:ready", "B:ready"]);
        });

        it("runs onFirstLogin only once, and onReady again after a loading screen", () => {
            log.length = 0;
            game.frames.fire("PLAYER_ENTERING_WORLD", false, false);
            expect(log).toEqual(["A:ready", "B:ready"]);
        });
    });

    describe("the events a service listens to", () => {
        it("reach the method with their payload", () => {
            game.frames.fire("PLAYER_DEAD");
            game.frames.fire("UNIT_AURA", "player");
            expect(log).toEqual(["A:dead", "B:dead", "A:aura player", "B:aura player"]);
        });

        it("include the addon's own events", () => {
            addon.events.emit("test.pinged", 3);
            expect(log).toEqual(["A:ping 3", "B:ping 3"]);
        });
    });

    describe("the interval of a service", () => {
        it("does not run before the first login", () => {
            game.clock.advance(2);
            expect(first.ticks).toBe(0);
        });

        it("runs from the first login on", () => {
            game.frames.fire("PLAYER_LOGIN");
            game.clock.advance(1);
            expect(first.ticks).toBeGreaterThan(3);
            expect(second.ticks).toBe(first.ticks);
        });

        it("stops at logout", () => {
            game.frames.fire("PLAYER_LOGIN");
            game.clock.advance(1);
            game.frames.fire("PLAYER_LOGOUT");
            const ticksAtLogout = first.ticks;
            game.clock.advance(2);
            expect(first.ticks).toBe(ticksAtLogout);
            expect(log).toContain("A:logout");
        });
    });
});
