// Bars faded until their buttons glow: the buttons of a faded bar are drawn faint while no glow is lit on them, and in full
// while one is, so a bar in the middle of the screen shows only what is due. Only the opacity this service set is changed
// back: a bar no longer faded shows in full again.
import { BARS } from "./action-bars.service";
import type { GlowService } from "./glow.service";
import { getReadable } from "./utils/secret-value.utils";

/** An opacity this close to the wanted one is it (the client keeps opacities as bytes). */
const ALPHA_MARGIN = 0.01;

export class BarFadeService {
    /** The buttons this service faded, with the opacity it gave them. */
    private readonly faded = new LuaMap<ActionButton, number>();

    constructor(private readonly glow: GlowService) {}

    /** Fades the buttons of some bars (bar number, as Edit Mode numbers them -> opacity, 0 to 1) while they do not glow. */
    applyBarFades(opacityByBar: LuaMap<number, number>): void {
        const wanted = new LuaMap<ActionButton, number>();
        for (const [bar, opacity] of opacityByBar) {
            for (const button of this.listBarButtons(bar)) wanted.set(button, this.glow.isGlowing(button) ? 1 : opacity);
        }
        for (const [button, opacity] of wanted) {
            // The game sets a button's opacity too (as it updates the bars): the button's own is the one to compare, when
            // the client lets it be read (in combat it may keep it secret: then it is set all the same)
            const alpha = getReadable(button.GetAlpha());
            if (alpha === undefined || math.abs(alpha - opacity) > ALPHA_MARGIN) button.SetAlpha(opacity);
            this.faded.set(button, opacity);
        }
        for (const [button] of this.faded) {
            if (!wanted.has(button)) {
                button.SetAlpha(1);
                this.faded.delete(button);
            }
        }
    }

    /** The buttons of a bar (1 the main bar, 2 to 8 the others). */
    private listBarButtons(bar: number): ActionButton[] {
        const prefix = BARS[bar - 1];
        const buttons: ActionButton[] = [];
        if (prefix === undefined) return buttons;
        for (let i = 1; i <= 12; i++) {
            const button = (_G as unknown as { [name: string]: ActionButton | undefined })[`${prefix}Button${i}`];
            if (button) buttons.push(button);
        }
        return buttons;
    }
}
