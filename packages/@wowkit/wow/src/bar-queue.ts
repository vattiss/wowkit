// The buttons the action bars are mapped from, in order (every bar's, the gamepad's, the stances, the ones other addons
// registered), and the slot a button shows now.
import type { ButtonRegistryService } from "./button-registry.service";
import { BARS, listAddonButtonNames, listTotemButtonNames } from "./bar-names";
import { listGamepadButtons } from "./gamepad-buttons";
import { listLibraryButtons } from "./library-buttons";
import { attempt } from "./utils/protected-call.utils";

/**
 * A button to map: an action button (by its slot), a stance (by its index), or a button of the gamepad bars that shows a
 * spell of its own (the paladin's aura, picked from a flyout: no action slot, the spell in its `spellID`).
 */
export type QueueEntry = { button: ActionButton } | { stance: number; button: ActionButton | undefined } | { spellButton: ActionButton };

const getGlobal = <T>(name: string): T | undefined => (_G as unknown as { [name: string]: T | undefined })[name];

/**
 * Every button to map: the bars' (Blizzard's, the totem bar, Bartender4's, Dominos's, EllesmereUI's, ElvUI's, DaylightUI's,
 * ConsolePort's, the gamepad bars, those LibActionButton-1.0 made that are on no list, the ones other addons registered),
 * then the stances. A button is in it once.
 */
export function listButtonsToMap(registry: ButtonRegistryService): QueueEntry[] {
    const queue: QueueEntry[] = [];
    const queued = new LuaSet<ActionButton>();
    const addButton = (button: ActionButton | undefined) => {
        if (button === undefined || queued.has(button)) return;
        queued.add(button);
        queue.push({ button });
    };
    const add = (name: string) => addButton(getGlobal<ActionButton>(name));
    for (const bar of BARS) for (let i = 1; i <= 12; i++) add(`${bar}Button${i}`);
    // The shaman's totem bar: its buttons are action buttons too
    for (const name of listTotemButtonNames()) add(name);
    for (const name of listAddonButtonNames()) add(name);
    for (const button of listGamepadButtons()) {
        queue.push(readActionSlot(button) === undefined ? { spellButton: button } : { button });
    }
    // ConsolePort's crossbar, and any other addon's bars of the library, by what the library made
    for (const button of listLibraryButtons()) addButton(button);
    // The buttons other addons registered (and those the search found)
    for (const button of registry.listActionButtons()) addButton(button);
    queue.push(...listStancesToMap(registry));
    return queue;
}

/**
 * The stance bar: Blizzard's, and Bartender4's, Dominos's and ElvUI's, whose buttons stand for the same forms (a paladin's
 * auras too); then the stance buttons other addons registered, of the stances there are.
 */
function listStancesToMap(registry: ButtonRegistryService): QueueEntry[] {
    const queue: QueueEntry[] = [];
    const forms = attempt(GetNumShapeshiftForms) ?? 0;
    for (let i = 1; i <= forms; i++) {
        for (const name of [`StanceButton${i}`, `BT4StanceButton${i}`, `DominosStanceButton${i}`, `ElvUI_StanceBarButton${i}`])
            queue.push({ stance: i, button: getGlobal<ActionButton>(name) });
    }
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
