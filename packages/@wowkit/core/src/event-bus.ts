/* eslint-disable @typescript-eslint/no-explicit-any -- handlers of every shape are stored here */
// The addon's own events (Nest's EventEmitter): a service emits a named event, other services
// listen with @OnEvent("name"). Each event is declared where it comes from, by adding to AppEvents:
//
//     declare module "./event-bus" {
//         interface AppEvents {
//             "spells.invalidated": [];
//         }
//     }
/** The events of the addon and what they carry; each service adds its own (see above). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppEvents {}

/** What an event carries, as the parameter list of its handlers. */
export type EventPayload<K extends keyof AppEvents> = AppEvents[K] & unknown[];

export class EventBus {
    private readonly handlers = new LuaMap<string, ((this: void, ...payload: any[]) => void)[]>();

    on<K extends keyof AppEvents & string>(name: K, handler: (this: void, ...payload: EventPayload<K>) => void): void {
        const list = this.handlers.get(name) ?? [];
        list.push(handler);
        this.handlers.set(name, list);
    }

    emit<K extends keyof AppEvents & string>(name: K, ...payload: EventPayload<K>): void {
        // A copy, so a handler may listen to more while the event is delivered
        for (const handler of [...(this.handlers.get(name) ?? [])]) handler(...(payload as unknown[]));
    }
}
