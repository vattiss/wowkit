// The door for other addons, in the global GlowingBars: a UI addon with bars of its own registers its action buttons,
// and they glow as Blizzard's do. A button keeps its action slot where Blizzard's buttons do (made from
// ActionBarButtonTemplate, or LibActionButton-1.0); a stance button has no slot, so it says which stance it stands for.
// An addon that lists GlowingBars in its OptionalDeps loads after it, and finds the API there.
import type { ActionBarsService } from "@wowkit/wow";
import { BARS } from "@wowkit/wow";

export interface GlowingBarsApi {
    /**
     * A button to glow on, counting as Action Bar `bar` (1 to 8: its switch and its fading on the Settings page), or as no
     * bar when left out. Mapped within a few seconds, out of combat.
     */
    RegisterButton: (this: void, button: ActionButton, bar?: number) => void;
    /** A stance button to glow on (a form, a paladin's aura), standing for the stance `stance` (1 the first). */
    RegisterStanceButton: (this: void, button: ActionButton, stance: number) => void;
}

/** A whole number from `low` up; undefined for anything else. */
function readWhole(value: unknown, low: number): number | undefined {
    return type(value) === "number" && (value as number) >= low ? math.floor(value as number) : undefined;
}

/** Puts the API in the global GlowingBars. */
export function installPublicApi(actionBars: ActionBarsService): void {
    const api: GlowingBarsApi = {
        RegisterButton: (button, bar) => {
            if (type(button) !== "table") return;
            const number = readWhole(bar, 1);
            actionBars.registerButton(button, number !== undefined && number <= BARS.length ? number : undefined);
        },
        RegisterStanceButton: (button, stance) => {
            const index = readWhole(stance, 1);
            if (type(button) === "table" && index !== undefined) actionBars.registerStanceButton(button, index);
        },
    };
    (_G as unknown as { GlowingBars?: GlowingBarsApi }).GlowingBars = api;
}
