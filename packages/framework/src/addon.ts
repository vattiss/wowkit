// Starting an addon: connect what the services listen to, and run their lifecycle hooks.
import { EventBus } from "./event-bus";
import { listenToGameEvent, listenToUnitEvent, runInterval } from "./game-events";
import { listeners, type ListenerSpec } from "./metadata";
import type { Class, HookName } from "./types";

type Instance = Record<string, ((self: unknown, ...args: unknown[]) => void) | undefined>;

/** Calls a method of the service; `instance[name](instance, ...)` is how Lua passes `self`. */
function callMethod(instance: Instance, name: string, ...args: unknown[]): void {
    const method = instance[name];
    if (method === undefined) throw new Error(`no method ${name}`);
    method(instance, ...args);
}

interface Interval {
    instance: Instance;
    seconds: number;
    method: string;
}

/**
 * The addon: its services are made by hand, in order, and handed to `register`; `start` then connects them to the
 * game's events and runs their lifecycle hooks.
 *
 *     const addon = new Addon(addonName);
 *     const settings = addon.register(new SettingsService(...));
 *     addon.start();
 *
 * Lifecycle, in order: `onAddonLoaded` at ADDON_LOADED of this addon (the saved data is there); at the first
 * PLAYER_LOGIN or PLAYER_ENTERING_WORLD `onFirstLogin` once and then the regular work (@Interval)
 * starts; `onLogin` at PLAYER_LOGIN only; `onReady` after PLAYER_LOGIN and after every
 * PLAYER_ENTERING_WORLD; `onLogout` at PLAYER_LOGOUT, when the regular work stops. Hooks run in
 * the order the services were registered, so a service is registered after the services it needs.
 */
export class Addon {
    /** The addon's own events; services that emit or listen are given this one. */
    readonly events = new EventBus();
    private readonly services: Instance[] = [];
    private readonly intervals: Interval[] = [];
    private stoppers: (() => void)[] = [];
    private hasBooted = false;

    constructor(private readonly addonName: string) {}

    /** Takes a service into the addon, and gives it back. */
    register<T extends object>(service: T): T {
        this.services.push(service as Instance);
        return service;
    }

    start(): void {
        for (const instance of this.services) this.connectListeners(instance);
        const stopWaiting = listenToGameEvent("ADDON_LOADED", (loaded) => {
            if (loaded !== this.addonName) return;
            stopWaiting();
            this.runHook("onAddonLoaded");
        });
        listenToGameEvent("PLAYER_LOGIN", () => {
            this.runFirstLogin();
            this.runHook("onLogin");
            this.runHook("onReady");
        });
        listenToGameEvent("PLAYER_ENTERING_WORLD", () => {
            this.runFirstLogin();
            this.runHook("onReady");
        });
        listenToGameEvent("PLAYER_LOGOUT", () => this.stopWork());
    }

    /** Connects the methods of a service to the events and timers they listen to. */
    private connectListeners(instance: Instance): void {
        const implementation = (instance as unknown as { constructor: Class }).constructor;
        const specs: ListenerSpec[] = listeners.get(implementation.prototype) ?? [];
        for (const spec of specs) {
            const handle = (...payload: unknown[]) => callMethod(instance, spec.method, ...payload);
            if (spec.kind === "game") listenToGameEvent(spec.name as WowEvent, handle);
            else if (spec.kind === "unit") listenToUnitEvent(spec.name as WowEvent, handle);
            else if (spec.kind === "event") this.events.on(spec.name as never, handle as never);
            else this.intervals.push({ instance, seconds: spec.seconds!, method: spec.method });
        }
    }

    private runHook(hook: HookName): void {
        for (const instance of this.services) {
            if (instance[hook] !== undefined) callMethod(instance, hook);
        }
    }

    private runFirstLogin(): void {
        if (this.hasBooted) return;
        this.hasBooted = true;
        this.runHook("onFirstLogin");
        this.stoppers = this.intervals.map(({ instance, seconds, method }) => runInterval(seconds, () => callMethod(instance, method)));
    }

    private stopWork(): void {
        for (const stop of this.stoppers) stop();
        this.stoppers = [];
        this.runHook("onLogout");
    }
}
