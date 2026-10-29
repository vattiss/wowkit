// The action buttons of the gamepad bars Forever draws in gamepad mode, in place of the usual ones: action buttons under
// names of their own ("GamepadMainActionBarFramePageUnitLeft...ActionButton1"), found among the frame's children.

const GAMEPAD_BAR = "GamepadMainActionBarFrame";
/** How deep the buttons of the gamepad bars sit under their frame, at most. */
const GAMEPAD_DEPTH = 6;

/** Every child of the gamepad bars' frame, at any depth, that shows an action slot; none outside gamepad mode. */
export function listGamepadButtons(): ActionButton[] {
    const found: ActionButton[] = [];
    const addButtonsUnder = (frame: Frame, depth: number) => {
        if (depth > GAMEPAD_DEPTH) return;
        for (const child of [...frame.GetChildren()]) {
            // An action button shows a slot; the class button a spell (`action` 0 and a `spellID`)
            if (type((child as { action?: unknown }).action) === "number") found.push(child as unknown as ActionButton);
            else addButtonsUnder(child, depth + 1);
        }
    };
    const root = (_G as unknown as { [name: string]: Frame | undefined })[GAMEPAD_BAR];
    if (root !== undefined) addButtonsUnder(root, 0);
    return found;
}
