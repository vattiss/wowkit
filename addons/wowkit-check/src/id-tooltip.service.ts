// Shows the IDs in the tooltips: the ID of every spell (in the spellbook too) and the spell an item casts when used
// (an elixir, a potion, food), so the IDs written in wow-data can be read off the game.
import type { TooltipService } from "@wowkit/wow";

export class IdTooltipService {
    constructor(private readonly tooltips: TooltipService) {}

    onAddonLoaded(): void {
        this.tooltips.addSpellLines((spellId) => `Spell ID: ${spellId}`);
        this.tooltips.addItemLines((itemId) => {
            const useSpellId = this.tooltips.getUseSpellId(itemId);
            return useSpellId === undefined ? undefined : `Use spell ID: ${useSpellId}`;
        });
    }
}
