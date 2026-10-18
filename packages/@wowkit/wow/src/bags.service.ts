// Items in the bags.

import { attempt } from "./utils/protected-call.utils";
import { getReadable } from "./utils/secret-value.utils";

export class BagsService {
    getItemCount(itemId: number): number {
        return getReadable(attempt(C_Item.GetItemCount, itemId)) ?? 0;
    }

    /** The item's name; undefined while the client has not loaded the item yet. */
    getItemName(itemId: number): string | undefined {
        return getReadable(attempt(C_Item.GetItemNameByID, itemId));
    }
}
