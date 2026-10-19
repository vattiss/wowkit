// The reagents part of the Reminders page: the switch, the sound, and a switch for each reagent of the player's class.

import type { AddonLocale } from "../locale/locale.interface";
import type { Reagent } from "../reagents/reagent.interface";
import type { ReagentsService } from "../reagents/reagents.service";
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
        private readonly reagents: ReagentsService,
        private readonly player: PlayerService,
    ) {}

    /** A class without reagents gets no section. */
    addReagentsSection(category: SettingsCategory, layout: SettingsLayout): void {
        const reagents = this.reagents.getReagentsOfClass(this.player.getClassToken());
        if (reagents.length === 0) return;
        this.reminderControls.addHeader(layout, "HDR_REAGENTS");
        this.reminderControls.addSwitch(category, "showReagents", "OPT_REAGENTS", "TIP_REAGENTS");
        for (const reagent of reagents) {
            this.controls.addCheckbox(
                category,
                `reagent_${reagent.itemId}`,
                this.reagents.getReagentName(reagent),
                this.locale.getText("TIP_REAGENT_ONE"),
                true,
                () => this.isReagentOn(reagent),
                (isChecked) => this.setReagentOn(reagent, isChecked),
            );
        }
    }

    private isReagentOn(reagent: Reagent): boolean {
        return this.settings.get("reagentOn")[String(reagent.itemId)] !== false;
    }

    /** Switches one reagent on or off; the default (on) is not stored. */
    private setReagentOn(reagent: Reagent, isOn: boolean): void {
        const reagentOn = { ...this.settings.get("reagentOn") };
        reagentOn[String(reagent.itemId)] = isOn ? undefined : false;
        this.settings.change("reagentOn", reagentOn);
    }
}
