// The addon's saved data. The game fills the global named in the TOC (## SavedVariablesPerCharacter)
// from the character's file before ADDON_LOADED and writes it back on logout.

declare global {
    var ForeverRemindersCharDB: object | undefined;
}

/** What the game loaded from the character's file; undefined on the first run. */
export function loadSavedTable<T extends object>(): Partial<T> | undefined {
    return ForeverRemindersCharDB as Partial<T> | undefined;
}

/** Makes `table` the data that is saved on logout. */
export function bindSavedTable(table: object): void {
    ForeverRemindersCharDB = table;
}
