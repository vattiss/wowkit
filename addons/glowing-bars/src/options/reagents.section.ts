// The reagent part of the Settings page: how few of a group buff's reagent in the bags is running low. Which reagents are
// reminded of is the table's.

import type { AddonLocale } from "../locale/locale.interface";
import type { CustomCuesService } from "../glows/custom-cues.service";
import type { ReagentsService } from "../reagents/reagents.service";
import { REAGENT_LOW_CHOICES } from "../settings/settings.constants";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";
import type { ControlsService } from "@wowkit/ui";
import type { PlayerService } from "@wowkit/wow";
import type { ReminderControlsService } from "./reminder-controls.service";

export class ReagentsSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
        private readonly player: PlayerService,
        private readonly reagents: ReagentsService,
        private readonly customCues: CustomCuesService,
    ) {}

    /** Nothing is added for a class with no group buff that costs a reagent, unless the player added one. */
    addReagentsSection(category: SettingsCategory, layout: SettingsLayout): void {
        const hasReagents =
            this.reagents.getReagentsOfClass(this.player.getClassToken()).length > 0 || this.customCues.listCustom("reagent").length > 0;
        if (!hasReagents) return;
        this.reminderControls.addHeader(layout, "HDR_REAGENTS");
        this.controls.addDropdown(
            category,
            "reagentLow",
            this.locale.getText("OPT_REAGENT_LOW"),
            this.locale.getText("TIP_REAGENT_LOW"),
            string.format("%d", this.settings.getDefault("reagentLow")),
            () => string.format("%d", this.settings.get("reagentLow")),
            (value) => this.settings.change("reagentLow", tonumber(value) ?? this.settings.getDefault("reagentLow")),
            () =>
                REAGENT_LOW_CHOICES.map((count): [string, string] => [
                    string.format("%d", count),
                    string.format(this.locale.getText("OPT_OR_FEWER"), count),
                ]),
            true,
        );
    }
}
