// Items in the bags.
import { attempt, getReadable } from "./safe";

export function getItemCount(itemId: number): number {
    return getReadable(attempt(C_Item.GetItemCount, itemId)) ?? 0;
}

/** The item's name; undefined while the client has not loaded the item yet. */
export function getItemName(itemId: number): string | undefined {
    return getReadable(attempt(C_Item.GetItemNameByID, itemId));
}
