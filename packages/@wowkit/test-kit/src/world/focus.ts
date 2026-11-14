// The keyboard of the game's edit boxes: one box at a time takes it, and its scripts are told as in the game.
import type { FakeFrame, FrameRegistry } from "./frames";

/** An edit box takes the keyboard (SetFocus) and gives it up (ClearFocus), telling its scripts as the game does. */
export function addFocus(registry: FrameRegistry, box: FakeFrame): void {
    const parts = box as FakeFrame & { SetFocus(): void; ClearFocus(): void; HasFocus(): boolean };
    parts.SetFocus = () => {
        if (registry.focused === box) return;
        const before = registry.focused as (FakeFrame & { ClearFocus(): void }) | undefined;
        before?.ClearFocus();
        registry.focused = box;
        box.scripts.OnEditFocusGained?.(box);
    };
    parts.ClearFocus = () => {
        if (registry.focused !== box) return;
        registry.focused = undefined;
        box.scripts.OnEditFocusLost?.(box);
    };
    parts.HasFocus = () => registry.focused === box;
}
