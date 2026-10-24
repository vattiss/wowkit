// The names of the action buttons of the numbered bars: Blizzard's eight bars of Edit Mode, and Bartender4's, Dominos's
// and EllesmereUI's, which count as the bars of the same number (their bar 2 is Action Bar 2).

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
/**
 * EllesmereUI's action buttons (its Action Bars module): made from Blizzard's template, so they keep the slot where
 * Blizzard's do, and named after the first slot of their bar, which paging does not change: EABButton61 is the first
 * button of its Action Bar 2. The first slot of each of its bars 1 to 8, less one (its EUI_ActionBars_Secure.lua).
 */
export const ELLESMERE_PREFIX = "EABButton";
const ELLESMERE_BAR_OFFSETS = [0, 60, 48, 24, 36, 144, 156, 168];
/** EllesmereUI's bars 9 and 10, of no Blizzard bar: their buttons are mapped, but on no numbered bar. */
const ELLESMERE_EXTRA_OFFSETS = [12, 108];

/** The bar (1 to 8) of EllesmereUI's button for this first slot; undefined for its bars 9 and 10. */
function findEllesmereBar(slot: number): number | undefined {
    const index = ELLESMERE_BAR_OFFSETS.findIndex((offset) => slot > offset && slot <= offset + 12);
    return index >= 0 ? index + 1 : undefined;
}

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

/** The names of every action button of the bar addons: Bartender4's, Dominos's, then EllesmereUI's (its bars 1 to 10). */
export function listAddonButtonNames(): string[] {
    const names: string[] = [];
    for (let i = 1; i <= BARTENDER_BUTTONS; i++) names.push(`${BARTENDER_PREFIX}${i}`);
    for (let i = 1; i <= DOMINOS_BUTTONS; i++) names.push(getDominosButtonName(i)!);
    for (const offset of [...ELLESMERE_BAR_OFFSETS, ...ELLESMERE_EXTRA_OFFSETS])
        for (let i = 1; i <= 12; i++) names.push(`${ELLESMERE_PREFIX}${offset + i}`);
    return names;
}

/** The bar (1 to 8) a button of this name is on; undefined for a button of no numbered bar (the totem bar, the stance bar). */
export function findBarNumber(name: string): number | undefined {
    // A Dominos button: its bar is the twelve its number falls in
    const dominosNumber = findDominosNumber(name);
    if (dominosNumber !== undefined) {
        const bar = math.ceil(dominosNumber / 12);
        return bar <= BARS.length ? bar : undefined;
    }
    // An EllesmereUI button: its bar is the one whose slots its number falls in
    const [ellesmereSlot] = string.match(name, `^${ELLESMERE_PREFIX}(%d+)$`);
    if (ellesmereSlot !== undefined) return findEllesmereBar(tonumber(ellesmereSlot)!);
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

/** The names of the buttons of a bar (1 to 8): Blizzard's, and Bartender4's, Dominos's and EllesmereUI's of the same number. */
export function listBarButtonNames(bar: number): string[] {
    const prefix = BARS[bar - 1];
    if (prefix === undefined) return [];
    const names: string[] = [];
    for (let i = 1; i <= 12; i++) {
        const id = (bar - 1) * 12 + i;
        names.push(
            `${prefix}Button${i}`,
            `${BARTENDER_PREFIX}${id}`,
            getDominosButtonName(id)!,
            `${ELLESMERE_PREFIX}${ELLESMERE_BAR_OFFSETS[bar - 1]! + i}`,
        );
    }
    return names;
}
