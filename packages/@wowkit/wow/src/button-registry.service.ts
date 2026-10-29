// The buttons other addons registered (a UI addon with bars of its own, through an addon's API): action buttons, with the
// bar each counts as, and stance buttons, with the stance each stands for. The bars are mapped with them
// (ActionBarsService), and the faded bars fade them (BarFadeService).

export class ButtonRegistryService {
    /** The action buttons, with the bar each counts as: 1 to 8, or 0 for none. */
    private readonly bars = new LuaMap<ActionButton, number>();
    /** The stance buttons, with the stance each stands for. */
    private readonly stances = new LuaMap<ActionButton, number>();

    /** An action button, counting as the bar `bar` (1 to 8), or as no bar. It keeps its action slot where Blizzard's do. */
    registerButton(button: ActionButton, bar: number | undefined): void {
        this.bars.set(button, bar ?? 0);
    }

    /** A stance button, standing for the stance `stance` (1 the first form, a paladin's first aura). */
    registerStanceButton(button: ActionButton, stance: number): void {
        this.stances.set(button, stance);
    }

    /** Was the button registered (as an action button or a stance button)? */
    isRegistered(button: ActionButton): boolean {
        return this.bars.has(button) || this.stances.has(button);
    }

    /** The bar a registered button counts as; undefined for a button of no bar, and for a stance button. */
    findBar(button: ActionButton): number | undefined {
        const bar = this.bars.get(button);
        return bar !== undefined && bar > 0 ? bar : undefined;
    }

    /** The action buttons: every one, or those that count as the bar `bar`. */
    listActionButtons(bar?: number): ActionButton[] {
        const buttons: ActionButton[] = [];
        for (const [button, buttonBar] of this.bars) if (bar === undefined || buttonBar === bar) buttons.push(button);
        return buttons;
    }

    /** The stance buttons, with the stance each stands for. */
    listStanceButtons(): [button: ActionButton, stance: number][] {
        const buttons: [ActionButton, number][] = [];
        for (const [button, stance] of this.stances) buttons.push([button, stance]);
        return buttons;
    }

    /** How many buttons were registered, stance buttons too. */
    countButtons(): number {
        return this.listActionButtons().length + this.listStanceButtons().length;
    }
}
