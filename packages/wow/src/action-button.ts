// Reading one action button: which slot it shows, what it casts, and its icon. Plain functions of the button
// and the game's answers; ActionBarsService decides what to do with them.
import { attempt, attemptMulti, getReadableId, isReadable } from "./safe";

export function getGlobal<T>(name: string): T | undefined {
    return (_G as unknown as { [name: string]: T | undefined })[name];
}

/** A value equal to `expected`; secret values never are (comparing them would raise an error). */
function isToken(value: unknown, expected: string): boolean {
    return isReadable(value) && value === expected;
}

/** A texture key: a readable file ID or a lowercase path. */
export function getTextureKey(value: unknown): number | string | undefined {
    if (!isReadable(value) || value === 0 || value === "") return undefined;
    if (type(value) === "number" && (value as number) > 0) return value as number;
    if (type(value) === "string") return string.lower(value as string);
    return undefined;
}

/**
 * The slot the button shows now. A Blizzard action button keeps the paged slot in GetPagedID /
 * `action` (a druid form or warrior stance pages the main bar, e.g. bear form to 73-84), while
 * its "action" attribute is the base slot 1-12, so the attribute comes last.
 */
export function getActionSlot(button: ActionButton): number | undefined {
    const getValidSlot = (slot: unknown) => (slot !== undefined && slot !== 0 ? (slot as number) : undefined);
    return (
        getValidSlot(button.GetPagedID ? attempt(() => button.GetPagedID!()) : undefined) ??
        getValidSlot(button.CalculateAction ? attempt(() => button.CalculateAction!()) : undefined) ??
        getValidSlot(button.action) ??
        getValidSlot(tonumber(attempt(() => button.GetAttribute("action"))))
    );
}

export function hasAction(slot: number): boolean {
    return attempt(C_ActionBar.HasAction, slot) === true;
}

/** The spell an item casts (a poison, a warlock stone): that is what the reminders name. */
function findItemSpell(actionId: unknown): number | undefined {
    const itemId = getReadableId(actionId);
    const [didReadItemSpell, , itemSpell] = attemptMulti(() => C_Item.GetItemSpell(itemId));
    return didReadItemSpell ? getReadableId(itemSpell) : undefined;
}

/** What an action slot holds: "spell" with a spell ID, "macro" with a macro, or nothing known. */
function getSlotAction(slot: number): LuaMultiReturn<[kind: string | undefined, id: unknown]> {
    const [didSucceed, kind, actionId, , spellFromAction] = attemptMulti(() => GetActionInfo(slot));
    if (!didSucceed) return $multi(undefined, undefined);
    if (isToken(kind, "spell")) return $multi("spell", getReadableId(spellFromAction) ?? getReadableId(actionId));
    if (isToken(kind, "macro")) return $multi("macro", actionId);
    const itemSpell = isToken(kind, "item") ? findItemSpell(actionId) : undefined;
    if (itemSpell !== undefined) return $multi("spell", itemSpell);
    return $multi(undefined, undefined);
}

/** What the button casts: "spell" with a spell ID, "macro" with a macro, or nothing known. */
export function getButtonAction(button: ActionButton, slot: number | undefined): LuaMultiReturn<[kind: string | undefined, id: unknown]> {
    const attrType = attempt(() => button.GetAttribute("type"));
    if (attrType === "spell" || attrType === "macro")
        return $multi(
            attrType,
            attempt(() => button.GetAttribute(attrType)),
        );
    if (attrType !== undefined && attrType !== "action") return $multi(attrType, undefined);
    if (slot === undefined || !hasAction(slot)) return $multi(attrType, undefined);
    const [kind, id] = getSlotAction(slot);
    return $multi(kind ?? attrType, id);
}
