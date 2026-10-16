// Typed game-event subscriptions on top of a single hidden frame.
// Payload types come from types/generated/wow-events.d.ts.
import { getCastingSpellName } from "./player";
import { resolveFromName } from "./spells";

type EventHandler<E extends WowEvent> = (this: void, ...payload: WowEventPayloads[E]) => void;
type AnyHandler = (this: void, ...payload: unknown[]) => void;

const eventFrame = CreateFrame("Frame");
const handlers: { [event: string]: AnyHandler[] | undefined } = {};

eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => {
    const list = handlers[event];
    if (list === undefined) return;
    // Copy so handlers may unsubscribe while the event is dispatched
    for (const handler of [...list]) handler(...payload);
});

function subscribe(event: WowEvent, handler: AnyHandler, register: (this: void) => void): () => void {
    let list = handlers[event];
    if (list === undefined) {
        list = [];
        handlers[event] = list;
        register();
    }
    list.push(handler);
    return () => {
        const current = handlers[event];
        if (current === undefined) return;
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
        if (current.length === 0) {
            handlers[event] = undefined;
            eventFrame.UnregisterEvent(event);
        }
    };
}

/** Subscribes to a game event; returns a function that unsubscribes. */
export function onEvent<E extends WowEvent>(event: E, handler: EventHandler<E>): () => void {
    return subscribe(event, handler as AnyHandler, () => eventFrame.RegisterEvent(event));
}

/**
 * Subscribes to a unit event for the player only (not every nameplate and party member).
 * One event should use either onEvent or onPlayerEvent, not both.
 */
export function onPlayerEvent<E extends WowEvent>(event: E, handler: EventHandler<E>): () => void {
    return subscribe(event, handler as AnyHandler, () => eventFrame.RegisterUnitEvent(event, "player"));
}

export interface PlayerSpellCast {
    /** The spell's ID; found by its name when the client hid the ID; undefined when unknown. */
    spellId: number | undefined;
    /** The spell's name from the start of the cast; undefined for instant spells or when hidden. */
    spellName: string | undefined;
}

/** The player finished casting a spell. In combat the client hides the spell's ID. */
export function onPlayerSpellCast(handler: (this: void, cast: PlayerSpellCast) => void): void {
    let lastCastName: string | undefined;
    onPlayerEvent("UNIT_SPELLCAST_START", () => {
        lastCastName = getCastingSpellName() ?? lastCastName;
    });
    onPlayerEvent("UNIT_SPELLCAST_SUCCEEDED", (_unit, _castGuid, spellId) => {
        const spellName = lastCastName;
        lastCastName = undefined;
        const isHidden = spellId === undefined || issecretvalue(spellId);
        handler({ spellId: isHidden ? resolveFromName(spellName) : spellId, spellName });
    });
}
