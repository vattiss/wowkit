// The names of the action buttons of the numbered bars: Blizzard's eight bars of Edit Mode, and Bartender4's, which count
// as the bars of the same number (its bar 2 is Action Bar 2).

/** The bars of Edit Mode, 1 to 8, by the prefix of their buttons' names. */
export const BARS = [
    "Action",
    "MultiBarBottomLeft",
    "MultiBarBottomRight",
    "MultiBarRight",
    "MultiBarLeft",
    "MultiBar5",
    "MultiBar6",
    "MultiBar7",
];

/**
 * Bartender4's buttons (LibActionButton-1.0, which keeps the action slot where Blizzard's buttons do): BT4Button1 to
 * BT4Button180, 12 to a bar. Where Bartender4 is not loaded there are none.
 */
export const BARTENDER_PREFIX = "BT4Button";
export const BARTENDER_BUTTONS = 180;

/** The bar (1 to 8) a button of this name is on; undefined for a button of no numbered bar (the totem bar, the stance bar). */
export function findBarNumber(name: string): number | undefined {
    // A Bartender4 button: its bar is the twelve its number falls in
    const [bartenderIndex] = string.match(name, `^${BARTENDER_PREFIX}(%d+)$`);
    if (bartenderIndex !== undefined) {
        const bar = math.ceil(tonumber(bartenderIndex)! / 12);
        return bar <= BARS.length ? bar : undefined;
    }
    const [prefix] = string.match(name, "^(.-)Button%d+$");
    const index = prefix !== undefined ? BARS.indexOf(prefix) : -1;
    return index >= 0 ? index + 1 : undefined;
}

/** The names of the buttons of a bar (1 to 8): Blizzard's, and Bartender4's of the same number. */
export function listBarButtonNames(bar: number): string[] {
    const prefix = BARS[bar - 1];
    if (prefix === undefined) return [];
    const names: string[] = [];
    for (let i = 1; i <= 12; i++) names.push(`${prefix}Button${i}`, `${BARTENDER_PREFIX}${(bar - 1) * 12 + i}`);
    return names;
}
