// The buttons the action bars are mapped from, in order (every bar's, the gamepad's, the stances, the ones other addons
// registered), and the slot a button shows now.
import type { ButtonRegistryService } from "./button-registry.service";
import { BARS, listAddonButtonNames, listTotemButtonNames } from "./bar-names";
import { listGamepadButtons } from "./gamepad-buttons";
import { attempt } from "./utils/protected-call.utils";

/**
 * A button to map: an action button (by its slot), a stance (by its index), or a button of the gamepad bars that shows a
 * spell of its own (the paladin's aura, picked from a flyout: no action slot, the spell in its `spellID`).
 */
export type QueueEntry = { button: ActionButton } | { stance: number; button: ActionButton | undefined } | { spellButton: ActionButton };

const getGlobal = <T>(name: string): T | undefined => (_G as unknown as { [name: string]: T | undefined })[name];

/**
 * Every button to map: the bars' (Blizzard's, the totem bar, Bartender4's, Dominos's, EllesmereUI's, ElvUI's, DaylightUI's,
 * the ones other addons registered, the gamepad bars), then the stances.
 */
export function listButtonsToMap(registry: ButtonRegistryService): QueueEntry[] {
    const queue: QueueEntry[] = [];
    const add = (name: string) => {
        const button = getGlobal<ActionButton>(name);
        if (button) queue.push({ button });
    };
    for (const bar of BARS) for (let i = 1; i <= 12; i++) add(`${bar}Button${i}`);
    // The shaman's totem bar: its buttons are action buttons too
    for (const name of listTotemButtonNames()) add(name);
    for (const name of listAddonButtonNames()) add(name);
    for (const button of listGamepadButtons()) {
        queue.push(readActionSlot(button) === undefined ? { spellButton: button } : { button });
    }
    const forms = attempt(GetNumShapeshiftForms) ?? 0;
    // The stance bar: Blizzard's, and Bartender4's, Dominos's and ElvUI's, whose buttons stand for the same forms (a
    // paladin's auras too)
    for (let i = 1; i <= forms; i++) {
        for (const name of [`StanceButton${i}`, `BT4StanceButton${i}`, `DominosStanceButton${i}`, `ElvUI_StanceBarButton${i}`])
            queue.push({ stance: i, button: getGlobal<ActionButton>(name) });
    }
    queue.push(...listRegisteredToMap(registry, forms));
    return queue;
}

/** The buttons other addons registered: the action buttons, and the stance buttons of the stances there are. */
function listRegisteredToMap(registry: ButtonRegistryService, forms: number): QueueEntry[] {
    const queue: QueueEntry[] = registry.listActionButtons().map((button) => ({ button }));
    for (const [button, stance] of registry.listStanceButtons()) if (stance <= forms) queue.push({ stance, button });
    return queue;
}

/**
 * The slot the button shows now. A Blizzard action button keeps the paged slot in GetPagedID /
 * `action` (a druid form or warrior stance pages the main bar, e.g. bear form to 97-108 on Forever), while
 * its "action" attribute is the base slot 1-12, so the attribute comes last.
 */
export function readActionSlot(button: ActionButton): number | undefined {
    const getValidSlot = (slot: unknown) => (slot !== undefined && slot !== 0 ? (slot as number) : undefined);
    return (
        getValidSlot(button.GetPagedID ? attempt(() => button.GetPagedID!()) : undefined) ??
        getValidSlot(button.CalculateAction ? attempt(() => button.CalculateAction!()) : undefined) ??
        getValidSlot(button.action) ??
        getValidSlot(tonumber(attempt(() => button.GetAttribute("action"))))
    );
}
