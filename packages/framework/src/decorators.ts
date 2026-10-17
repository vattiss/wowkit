/* eslint-disable @typescript-eslint/no-explicit-any -- a decorator stores methods and constructors of every shape */
// The decorators, as in Nest / Angular. They only note down what was written (metadata.ts);
// Addon.start does the wiring (addon.ts).
//
//     export class RefreshService {
//         constructor(private readonly ticker: TickService) {}
//
//         @OnGameEvent("PLAYER_DEAD")
//         requestFreshTick(): void { ... }
//     }
import type { AppEvents, EventPayload } from "./event-bus";
import { addListener } from "./metadata";

/**
 * A decorator that accepts only a method which can be called with these arguments, so a handler with
 * the wrong parameters for its event does not compile.
 */
type ForMethodTaking<Args extends unknown[]> = <Method extends (this: any, ...args: Args) => void>(
    this: any,
    prototype: object,
    method: string | symbol,
    descriptor: TypedPropertyDescriptor<Method>,
) => void;

/** Method: call it for these game events (PLAYER_DEAD...). */
export function OnGameEvent<E extends WowEvent>(...events: E[]): ForMethodTaking<WowEventPayloads[E]> {
    return (prototype, method) => {
        for (const name of events) addListener(prototype, { kind: "game", name, method: method as string });
    };
}

/** Method: call it for these game events when they are about the player (UNIT_AURA...). */
export function OnUnitEvent<E extends WowEvent>(...events: E[]): ForMethodTaking<WowEventPayloads[E]> {
    return (prototype, method) => {
        for (const name of events) addListener(prototype, { kind: "unit", name, method: method as string });
    };
}

/** Method: call it when the addon announces something on the EventBus (see AppEvents). */
export function OnEvent<K extends keyof AppEvents & string>(...names: K[]): ForMethodTaking<EventPayload<K>> {
    return (prototype, method) => {
        for (const name of names) addListener(prototype, { kind: "event", name, method: method as string });
    };
}

/** Method: call it every `milliseconds`, from the first login until logout. */
export function Interval(milliseconds: number): ForMethodTaking<[]> {
    return (prototype, method) => {
        addListener(prototype, { kind: "interval", seconds: milliseconds / 1000, method: method as string });
    };
}
