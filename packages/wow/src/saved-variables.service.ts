// The addon's saved data. The game fills the global named in the TOC (## SavedVariablesPerCharacter)
// from the character's file before ADDON_LOADED and writes it back on logout.

export class SavedVariablesService {
    constructor(private readonly variableName: string) {}

    /** What the game loaded from the character's file; undefined on the first run. */
    loadTable<T extends object>(): Partial<T> | undefined {
        return (_G as unknown as Record<string, Partial<T> | undefined>)[this.variableName];
    }

    /** Makes `table` the data that is saved on logout. */
    bindTable(table: object): void {
        (_G as unknown as Record<string, object>)[this.variableName] = table;
    }
}
