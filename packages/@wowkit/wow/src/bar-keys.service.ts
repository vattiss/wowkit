// The bars by the key the settings know them by: a bar's number, or the stance bars, which have no number.
import type { ActionBarsService } from "./action-bars.service";
import { STANCE_BUTTONS, STANCE_PREFIXES } from "./bar-names";
import type { ButtonRegistryService } from "./button-registry.service";

/** The stance bars (a paladin's auras, a warrior's stances, a druid's forms), in the settings of which bars glow and fade. */
export const STANCE_BAR_KEY = "stance";

export class BarKeysService {
    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly registry: ButtonRegistryService,
    ) {}

    /** The key of a button's bar; undefined for a button of no such bar (the totem bar). */
    getBarKey(button: ActionButton): string | undefined {
        if (this.isStanceButton(button)) return STANCE_BAR_KEY;
        const bar = this.actionBars.getBarNumber(button);
        return bar !== undefined ? string.format("%d", bar) : undefined;
    }

    listStanceButtons(): ActionButton[] {
        const globals = _G as unknown as { [name: string]: ActionButton | undefined };
        const buttons = this.registry.listStanceButtons().map(([button]) => button);
        for (const prefix of STANCE_PREFIXES) {
            for (let i = 1; i <= STANCE_BUTTONS; i++) {
                const button = globals[`${prefix}${i}`];
                if (button !== undefined) buttons.push(button);
            }
        }
        return buttons;
    }

    private isStanceButton(button: ActionButton): boolean {
        if (this.registry.listStanceButtons().some(([registered]) => registered === button)) return true;
        const name = button.GetName() ?? "";
        return STANCE_PREFIXES.some((prefix) => string.sub(name, 1, prefix.length) === prefix);
    }
}
