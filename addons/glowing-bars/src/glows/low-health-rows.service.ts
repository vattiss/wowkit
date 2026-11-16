// A defensive at low health (Templar's Bulwark) had its look and switch on the row of its spell; with the proc rules the
// spell can have a row of its own too, so the low health has its own row now. What the player set moves there, once. A look
// is kept by the spell's name in the client's language, so only the game can tell which is theirs: this runs as the addon
// is ready.
import type { OnReady } from "@wowkit/core";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { findLowHealthRow } from "../settings/settings.constants";
import { LOW_HEALTH_CUES } from "./glow-cues.constants";

export class LowHealthRowsService implements OnReady {
    constructor(
        private readonly settings: AddonSettingsService,
        private readonly styles: StyleService,
    ) {}

    onReady(): void {
        if (this.settings.get("areLowHealthRowsMoved")) return;
        const looks = { ...this.settings.get("spellStyles") };
        const switches = { ...this.settings.get("enabledSpells") };
        for (const [, ids] of pairs(LOW_HEALTH_CUES)) {
            for (const listId of ids ?? []) {
                const rowId = findLowHealthRow(listId);
                const oldLook = `proc:${this.styles.getSpellKey(listId)}`;
                const newLook = `proc:${this.styles.getSpellKey(rowId)}`;
                looks[newLook] ??= looks[oldLook];
                looks[oldLook] = undefined;
                const oldSwitch = string.format("%d", listId);
                switches[string.format("%d", rowId)] ??= switches[oldSwitch];
                switches[oldSwitch] = undefined;
            }
        }
        this.settings.change("spellStyles", looks);
        this.settings.change("enabledSpells", switches);
        this.settings.change("areLowHealthRowsMoved", true);
    }
}
