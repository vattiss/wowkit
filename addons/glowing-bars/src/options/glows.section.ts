// The cooldown part of the Settings page: also at the start of a fight. Which cooldowns glow, how they look, when (in
// combat only, by default) and for how long (3 seconds, by default), is the table's.

import type { OptionsTab } from "@wowkit/ui";
import type { GlowCuesService } from "../glows/glow-cues.service";
import type { ReminderControlsService } from "./reminder-controls.service";

export class GlowsSection {
    constructor(
        private readonly reminderControls: ReminderControlsService,
        private readonly glowCues: GlowCuesService,
    ) {}

    /** Whether the ready cooldowns glow as a fight starts (the rest is the table's); nothing for a character without one. */
    addGlowsSection(tab: OptionsTab): void {
        if (this.glowCues.listCueIds("readyCooldown").length === 0) return;
        this.reminderControls.addHeader(tab, "HDR_COOLDOWNS");
        this.reminderControls.addSwitch(tab, "showCooldownsAtFightStart", "OPT_COOLDOWNS_FIGHT_START", "TIP_COOLDOWNS_FIGHT_START");
    }
}
