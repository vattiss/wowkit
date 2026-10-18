// The door of the core: what a service or the wiring imports.
export { Addon } from "./addon";
export { Interval, OnEvent, OnGameEvent, OnUnitEvent } from "./decorators";
export { EventBus, type AppEvents } from "./event-bus";
export type { Class, OnFirstLogin, OnLogout, OnLogin, OnAddonLoaded, OnReady } from "./types";
export * from "./utils/text.utils";
