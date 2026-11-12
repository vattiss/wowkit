// The dropdown list a button of the addon opens: a click on the button, then its lines as the player sees them.
import type { FakeFrame } from "./frames";
import type { FakeMenuChoice } from "./install-ui";

/** The list hangs under its button: the frame anchored to it that holds a scroll frame. */
function findList(all: FakeFrame[], button: FakeFrame): { frame: FakeFrame; scroll: FakeFrame } | undefined {
    for (const frame of all) {
        if (frame.anchor !== button) continue;
        const scroll = all.find((other) => other.parent === frame && other.scrollChild !== undefined);
        if (scroll !== undefined) return { frame, scroll };
    }
    return undefined;
}

/** Clicks the button and reads the list it opened: its lines, and whether it scrolls. No list, no lines. */
export function readChoiceList(all: FakeFrame[], button: FakeFrame): { choices: FakeMenuChoice[]; isScrolling: boolean } {
    // A list still open from before: a second click would close it
    findList(all, button)?.frame.Hide();
    button.scripts.OnClick!(button);
    const list = findList(all, button);
    if (list === undefined || !list.frame.isShown) return { choices: [], isScrolling: false };
    const content = list.scroll.scrollChild!;
    const lines = all.filter((frame) => frame.parent === content && frame.frameType === "Button" && frame.isShown);
    const choices = lines.map((line) => ({
        label: line.fontStrings[0]!.text ?? "",
        isChosen: () => line.textures[0]!.isShown,
        choose: () => line.scripts.OnClick!(line),
    }));
    return { choices, isScrolling: content.height > list.scroll.height };
}
