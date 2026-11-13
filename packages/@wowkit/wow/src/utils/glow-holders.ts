// A glow beside its button (a Cooldown Manager icon, a gamepad button) is made on the screen, not in the button, so it takes
// none of the button's transparency: a window's Opacity, or a visibility rule that fades it out. It goes into a holder of
// its own that copies the button's effective transparency, and the game multiplies that with the glow's own, which can be
// a secret value that addon code cannot compute with. The holder is in UIParent, whose transparency the button's has in it
// already, so that is taken out. EllesmereUI holds its frames beside the icons the same way.
import { attempt } from "./protected-call.utils";
import { getReadable } from "./secret-value.utils";

export class GlowHolders {
    private readonly holders = new LuaMap<ActionButton, Frame>();

    /** The holder of a button's glows beside it, made on first use, as transparent as the button. */
    getHolder(button: ActionButton): Frame {
        let holder = this.holders.get(button);
        if (holder === undefined) {
            holder = CreateFrame("Frame", undefined, UIParent);
            holder.SetFrameStrata(button.GetFrameStrata());
            this.holders.set(button, holder);
            this.matchButton(button, holder);
        }
        return holder;
    }

    /** Each holder copies its button's transparency again: it changes as a window fades, and no event says so. */
    matchButtons(): void {
        for (const [button, holder] of this.holders) this.matchButton(button, holder);
    }

    /** A transparency the game hides keeps the last one known; an interface faded out entirely shows nothing anyway. */
    private matchButton(button: ActionButton, holder: Frame): void {
        const alpha = getReadable(attempt(() => button.GetEffectiveAlpha()));
        const screenAlpha = getReadable(attempt(() => UIParent.GetEffectiveAlpha()));
        if (alpha === undefined || type(alpha) !== "number" || screenAlpha === undefined || type(screenAlpha) !== "number") return;
        if (screenAlpha > 0) holder.SetAlpha(math.min(1, alpha / screenAlpha));
    }
}
