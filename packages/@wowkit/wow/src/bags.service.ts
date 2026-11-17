// Items in the bags.

import { OnGameEvent } from "@wowkit/core";
import { attempt } from "./utils/protected-call.utils";
import { getReadable } from "./utils/secret-value.utils";

/** The backpack and the four bags beside it. */
const LAST_BAG = 4;

export class BagsService {
    /** The items of the bags by their name (lowercase), counted at the first ask after the bags or an item's data changed. */
    private countsByName: LuaMap<string, number> | undefined;

    getItemCount(itemId: number): number {
        return getReadable(attempt(C_Item.GetItemCount, itemId)) ?? 0;
    }

    /**
     * How many of an item, by its name (one a tooltip names, in the client's language), are in the bags. Counted from the
     * bags themselves: the client may answer 0 for a name, even of an item in the bags (issue #81).
     */
    getItemCountByName(name: string): number {
        this.countsByName ??= this.countBagsByName();
        return this.countsByName.get(string.lower(name)) ?? 0;
    }

    /** The item's name; undefined while the client has not loaded the item yet. */
    getItemName(itemId: number): string | undefined {
        return getReadable(attempt(C_Item.GetItemNameByID, itemId));
    }

    @OnGameEvent("BAG_UPDATE_DELAYED", "GET_ITEM_INFO_RECEIVED")
    forgetCountsByName(): void {
        this.countsByName = undefined;
    }

    private countBagsByName(): LuaMap<string, number> {
        const counts = new LuaMap<string, number>();
        for (let bag = 0; bag <= LAST_BAG; bag++) {
            const slots = getReadable(attempt(C_Container.GetContainerNumSlots, bag)) ?? 0;
            for (let slot = 1; slot <= slots; slot++) {
                const info = getReadable(attempt(C_Container.GetContainerItemInfo, bag, slot));
                if (info === undefined) continue;
                // A name the slot does not give yet is the item's own, once the client has loaded it
                const name = getReadable(info.itemName) ?? this.getItemName(getReadable(info.itemID) ?? 0);
                if (name === undefined || name === "") continue;
                const key = string.lower(name);
                counts.set(key, (counts.get(key) ?? 0) + (getReadable(info.stackCount) ?? 1));
            }
        }
        return counts;
    }
}
