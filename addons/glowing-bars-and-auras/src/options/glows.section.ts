// The cooldown and proc part of the Reminders page: the switches, the colors and sounds, and a switch for each spell of the
// player's class that can glow.

import type { AddonLocale } from "../locale/locale.interface";
import { COOLDOWN_CUES, PROC_CUES } from "../glows/glow-cues.constants";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";
import type { ControlsService } from "@wowkit/ui";
import type { PlayerService, SpellsService } from "@wowkit/wow";
import type { ReminderControlsService } from "./reminder-controls.service";

export class GlowsSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
        private readonly player: PlayerService,
    ) {}

    addGlowsSection(category: SettingsCategory, layout: SettingsLayout): void {
        const classToken = this.player.getClassToken() ?? "";
        const cooldowns = COOLDOWN_CUES[classToken] ?? [];
        const procs = PROC_CUES[classToken] ?? [];
        if (cooldowns.length > 0) {
            this.reminderControls.addHeader(layout, "HDR_COOLDOWNS");
            this.reminderControls.addSwitch(category, "showCooldowns", "OPT_COOLDOWNS", "TIP_COOLDOWNS");
            this.reminderControls.addSwitch(
                category,
                "showCooldownsOutOfCombat",
                "OPT_COOLDOWNS_OUT_OF_COMBAT",
                "TIP_COOLDOWNS_OUT_OF_COMBAT",
            );
            this.addSpellCheckboxes(category, cooldowns);
        }
        if (procs.length > 0) {
            this.reminderControls.addHeader(layout, "HDR_PROCS");
            this.reminderControls.addSwitch(category, "showProcs", "OPT_PROCS", "TIP_PROCS");
            this.addSpellCheckboxes(category, procs);
        }
    }

    /** One checkbox per spell, labeled with its name; the default (on) is not stored. */
    private addSpellCheckboxes(category: SettingsCategory, spellIds: number[]): void {
        for (const spellId of spellIds) {
            this.controls.addCheckbox(
                category,
                `glow_${spellId}`,
                this.spells.getSpellLabel(spellId) ?? string.format("%d", spellId),
                this.locale.getText("TIP_GLOW_ONE"),
                true,
                () => this.settings.get("glowOn")[String(spellId)] !== false,
                (isChecked) => this.setGlowOn(spellId, isChecked),
            );
        }
    }

    /** Switches one spell on or off; the default (on) is not stored. */
    private setGlowOn(spellId: number, isOn: boolean): void {
        const glowOn = { ...this.settings.get("glowOn") };
        glowOn[String(spellId)] = isOn ? undefined : false;
        this.settings.change("glowOn", glowOn);
    }
}
