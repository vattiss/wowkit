// The low reagents of the lists had one row for each reagent; now each spell that takes a reagent has a row of its own
// ("Symbol of Kings (Greater Blessing of Kings)"). What the player set for a reagent's row moves to every spell of it, once:
// its switch, its limit and its look. A look is kept by the spell's name in the client's language, so only the game can tell
// which keys are a reagent's: this runs as the addon is ready, not with the other moves of the saved settings.
import type { OnReady } from "@wowkit/core";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { findReagentRowEntry, type ReagentsService } from "./reagents.service";
import { REAGENTS } from "./reagents.constants";

export class ReagentRowsService implements OnReady {
    constructor(
        private readonly settings: AddonSettingsService,
        private readonly styles: StyleService,
        private readonly reagents: ReagentsService,
    ) {}

    onReady(): void {
        if (this.settings.get("areReagentRowsSplit")) return;
        const wasOff = this.settings.get("enabledReagents");
        const enabledSpells = { ...this.settings.get("enabledSpells") };
        const belowLimits = { ...this.settings.get("belowLimits") };
        const spellStyles = { ...this.settings.get("spellStyles") };
        for (const reagent of REAGENTS) {
            const item = string.format("%d", reagent.itemId);
            const limit = belowLimits[`lowReagent:${item}`];
            const look = spellStyles[`lowReagent:${this.styles.getSpellKey(reagent.spells[0]!)}`];
            for (const listId of this.reagents.listRowIds(reagent)) {
                const key = string.format("%d", listId);
                if (wasOff[item] === false) enabledSpells[key] ??= false;
                if (limit !== undefined) belowLimits[`lowReagent:${findReagentRowEntry(listId)}`] ??= limit;
                if (look !== undefined) spellStyles[`lowReagent:${this.styles.getSpellKey(listId)}`] ??= look;
            }
            belowLimits[`lowReagent:${item}`] = undefined;
        }
        this.settings.change("enabledSpells", enabledSpells);
        this.settings.change("belowLimits", belowLimits);
        this.settings.change("spellStyles", spellStyles);
        this.settings.change("enabledReagents", {});
        this.settings.change("areReagentRowsSplit", true);
    }
}
