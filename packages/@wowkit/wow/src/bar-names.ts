// The names of the action buttons of the numbered bars: Blizzard's eight bars of Edit Mode, and Bartender4's and Dominos's,
// which count as the bars of the same number (their bar 2 is Action Bar 2).

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

/**
 * Dominos's action buttons, 1 to 168, 12 to a bar: made from Blizzard's template, so they keep the slot where Blizzard's
 * do, under the names Dominos gives them (its GetActionButtonName): the last button of each run, and the run's prefix.
 */
export const DOMINOS_BUTTONS = 168;
const DOMINOS_RUNS: [last: number, prefix: string][] = [
    [24, "DominosActionButton"],
    [36, "MultiBarRightActionButton"],
    [48, "MultiBarLeftActionButton"],
    [60, "MultiBarBottomRightActionButton"],
    [72, "MultiBarBottomLeftActionButton"],
    [132, "DominosActionButton"],
    [144, "MultiBar5ActionButton"],
    [156, "MultiBar6ActionButton"],
    [168, "MultiBar7ActionButton"],
];
/** Dominos's button numbers by name, made when first asked. */
let dominosNumbers: LuaMap<string, number> | undefined;

/** The name of Dominos's button of this number (1 to 168): its own buttons count on, Blizzard-named runs from 1. */
export function getDominosButtonName(id: number): string | undefined {
    let first = 1;
    for (const [last, prefix] of DOMINOS_RUNS) {
        if (id <= last) return prefix === "DominosActionButton" ? `${prefix}${id}` : `${prefix}${id - first + 1}`;
        first = last + 1;
    }
    return undefined;
}

/** The number of Dominos's button of this name; undefined for another name. */
function findDominosNumber(name: string): number | undefined {
    if (dominosNumbers === undefined) {
        dominosNumbers = new LuaMap();
        for (let id = 1; id <= DOMINOS_BUTTONS; id++) dominosNumbers.set(getDominosButtonName(id)!, id);
    }
    return dominosNumbers.get(name);
}

/** The bar (1 to 8) a button of this name is on; undefined for a button of no numbered bar (the totem bar, the stance bar). */
export function findBarNumber(name: string): number | undefined {
    // A Dominos button: its bar is the twelve its number falls in
    const dominosNumber = findDominosNumber(name);
    if (dominosNumber !== undefined) {
        const bar = math.ceil(dominosNumber / 12);
        return bar <= BARS.length ? bar : undefined;
    }
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

/** The names of the buttons of a bar (1 to 8): Blizzard's, and Bartender4's and Dominos's of the same number. */
export function listBarButtonNames(bar: number): string[] {
    const prefix = BARS[bar - 1];
    if (prefix === undefined) return [];
    const names: string[] = [];
    for (let i = 1; i <= 12; i++) {
        const id = (bar - 1) * 12 + i;
        names.push(`${prefix}Button${i}`, `${BARTENDER_PREFIX}${id}`, getDominosButtonName(id)!);
    }
    return names;
}
