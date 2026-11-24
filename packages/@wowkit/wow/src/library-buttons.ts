// The action buttons LibActionButton-1.0 made, for any addon that builds its bars with it: ConsolePort's crossbar names its
// buttons by the gamepad's bindings, so they cannot be listed by name, but the library keeps every button it made. Where no
// addon loaded the library there are none.
import { attempt } from "./utils/protected-call.utils";

/** The library's own method, under its own name. */
type ButtonLister = (this: ButtonLibrary) => LuaTable<ActionButton, unknown> | undefined;

interface ButtonLibrary {
    /** The library's own table of its buttons, read as it is: GetAllButtons copies it. */
    buttonRegistry?: LuaTable<ActionButton, unknown>;
    GetAllButtons: ButtonLister;
}

type LibraryLoader = (this: void, name: string, isSilent: boolean) => ButtonLibrary | undefined;

/** The library's buttons, as the keys of a table; undefined where no addon loaded it. */
function readLibraryButtons(): LuaTable<ActionButton, unknown> | undefined {
    const loader = (_G as unknown as { LibStub?: LibraryLoader }).LibStub;
    if (loader === undefined) return undefined;
    const library = attempt(() => loader("LibActionButton-1.0", true));
    if (library === undefined) return undefined;
    return type(library.buttonRegistry) === "table" ? library.buttonRegistry : attempt(() => library.GetAllButtons());
}

/** Every button the library made, shown or not. */
export function listLibraryButtons(): ActionButton[] {
    const buttons: ActionButton[] = [];
    const all = readLibraryButtons();
    if (all !== undefined) for (const [button] of pairs(all)) buttons.push(button);
    return buttons;
}

/** How many buttons the library made, with no list made of them: counted every few seconds. */
export function countLibraryButtons(): number {
    let count = 0;
    const all = readLibraryButtons();
    if (all !== undefined) for (const [,] of pairs(all)) count++;
    return count;
}
