// Small helpers for the maps of lists the action bars are mapped into.

/** Adds the value to the list under the key, making the list when there is none. */
export function pushToList<K extends AnyNotNil, V>(map: LuaMap<K, V[]>, key: K, value: V): void {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
}

/** Takes the value out of every list of the map; a list left empty goes with its key. */
export function removeFromLists<K extends AnyNotNil, V>(map: LuaMap<K, V[]>, value: V): void {
    for (const [key, list] of map) {
        for (let index = list.length - 1; index >= 0; index--) if (list[index] === value) table.remove(list, index + 1);
        if (list.length === 0) map.delete(key);
    }
}

/** Empties the map, keeping the map itself. */
export function clearMap<K extends AnyNotNil, V>(map: LuaMap<K, V>): void {
    for (const [key] of map) map.delete(key);
}
