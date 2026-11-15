// The rows of the proc rules' groups ("Revenge (dodge)"): each has an ID of its own, made up here for this session (below any
// spell's), so the table and the looks treat it as a spell's row. Its look is saved by the spell's name and the group, not
// by this ID.

/** The first made-up ID; each new group's row takes the next one down. */
const FIRST_ROW_ID = -100000;

export class ProcGroupRows {
    private readonly rowIds = new LuaMap<string, number>();
    private readonly groups = new LuaMap<number, { spellId: number; group: string }>();
    private nextRowId = FIRST_ROW_ID;

    /** The row of a spell's group, made the first time it is asked for. */
    findRowId(spellId: number, group: string): number {
        const key = `${spellId}:${group}`;
        const kept = this.rowIds.get(key);
        if (kept !== undefined) return kept;
        const rowId = this.nextRowId;
        this.nextRowId -= 1;
        this.rowIds.set(key, rowId);
        this.groups.set(rowId, { spellId, group });
        return rowId;
    }

    /** The spell and the group of a row; undefined for a row that is no group's. */
    findGroup(rowId: number): { spellId: number; group: string } | undefined {
        return this.groups.get(rowId);
    }
}
