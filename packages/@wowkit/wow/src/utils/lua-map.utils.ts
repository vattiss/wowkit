// Small helpers for the maps of lists the action bars are mapped into.

/** Adds the value to the list under the key, making the list when there is none. */
export function pushToList<K extends AnyNotNil, V>(map: LuaMap<K, V[]>, key: K, value: V): void {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
}

/** Empties the map, keeping the map itself. */
export function clearMap<K extends AnyNotNil, V>(map: LuaMap<K, V>): void {
    for (const [key] of map) map.delete(key);
}
