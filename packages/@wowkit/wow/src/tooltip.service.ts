// The lines an addon adds to the game's tooltips of spells and items, and the spell an item casts when it is used.
import { attemptMulti } from "./utils/protected-call.utils";
import { getReadableId } from "./utils/secret-value.utils";

/** Gives the text to add to the tooltip of the spell or item with this ID, or undefined for no line. */
export type TooltipLine = (id: number) => string | undefined;

export class TooltipService {
    /** Adds the line to the tooltip of every spell: in the spellbook, on the action bars, in links. */
    addSpellLines(getLine: TooltipLine): void {
        TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Spell, (tooltip, data) => this.addLine(tooltip, data, getLine));
    }

    /** Adds the line to the tooltip of every item: in the bags, in links, on the action bars. */
    addItemLines(getLine: TooltipLine): void {
        TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Item, (tooltip, data) => this.addLine(tooltip, data, getLine));
    }

    /** The spell an item casts when it is used (an elixir, a potion, food); undefined for an item with no use. */
    getUseSpellId(itemId: number): number | undefined {
        const [didSucceed, , spellId] = attemptMulti(() => C_Item.GetItemSpell(itemId));
        return didSucceed ? getReadableId(spellId) : undefined;
    }

    private addLine(tooltip: GameTooltip, data: TooltipData, getLine: TooltipLine): void {
        const id = getReadableId(data.id);
        if (id === undefined) return;
        const line = getLine(id);
        if (line !== undefined) tooltip.AddLine(line, 1, 1, 1);
    }
}
