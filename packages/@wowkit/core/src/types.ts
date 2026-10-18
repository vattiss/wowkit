/* eslint-disable @typescript-eslint/no-explicit-any -- classes, factories and handlers of every shape are described here */
// The words of the core: classes and lifecycle hooks.

/** A class (its constructor). Services are classes; the core reads the decorators on their prototype. */
export type Class<T = object> = new (...args: any[]) => T;

// ---------------------------------------------------------------------------------------------
// Lifecycle hooks. A service gets one by having a method of that name; nothing needs registering.
// They are named for the moments of the game, in the order they happen.

/** The addon's files are loaded and its saved data is available (ADDON_LOADED of this addon). */
export interface OnAddonLoaded {
    onAddonLoaded(): void;
}
/** Once, at the first login of the session. Regular work (@Interval) starts right after. */
export interface OnFirstLogin {
    onFirstLogin(): void;
}
/** PLAYER_LOGIN only: the moment to greet. */
export interface OnLogin {
    onLogin(): void;
}
/** After PLAYER_LOGIN and after every PLAYER_ENTERING_WORLD (a reload, a loading screen). */
export interface OnReady {
    onReady(): void;
}
/** PLAYER_LOGOUT: regular work has stopped. */
export interface OnLogout {
    onLogout(): void;
}

export type HookName = "onAddonLoaded" | "onFirstLogin" | "onLogin" | "onReady" | "onLogout";
