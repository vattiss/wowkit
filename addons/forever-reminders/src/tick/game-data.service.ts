// Reads the spells and the action bars once, at the first login.
import { type OnFirstLogin } from "@forever/framework";
import type { ActionBarsService, SpellsService } from "@forever/wow";

export class GameDataService implements OnFirstLogin {
    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
    ) {}

    onFirstLogin(): void {
        this.spells.invalidateSpells(true);
        this.spells.rebuildSpellBook(false);
        this.actionBars.mapBars(true);
    }
}
