// The cooldown and proc part of the Reminders page: the switches, the colors and sounds, and a switch for each spell of the
// player's class that can glow.

import type { AddonLocale } from "../locale/locale.interface";
import { PROC_CUES } from "../glows/glow-cues.constants";
import { COOLDOWN_GLOW_CHOICES } from "../settings/settings.constants";
import type { GlowCuesService } from "../glows/glow-cues.service";
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
        private readonly glowCues: GlowCuesService,
    ) {}

    addGlowsSection(category: SettingsCategory, layout: SettingsLayout): void {
        const classToken = this.player.getClassToken() ?? "";
        const cooldowns = this.glowCues.listCooldownIds();
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
            this.reminderControls.addSwitch(
                category,
                "showCooldownsAtFightStart",
                "OPT_COOLDOWNS_FIGHT_START",
                "TIP_COOLDOWNS_FIGHT_START",
            );
            this.addGlowSecondsDropdown(category);
            this.addSpellCheckboxes(category, cooldowns);
        }
        if (procs.length > 0) {
            this.reminderControls.addHeader(layout, "HDR_PROCS");
            this.reminderControls.addSwitch(category, "showProcs", "OPT_PROCS", "TIP_PROCS");
            this.addSpellCheckboxes(category, procs);
        }
    }

    /** How long a cooldown glows once it is back: a few seconds, or until it is pressed. */
    private addGlowSecondsDropdown(category: SettingsCategory): void {
        this.controls.addDropdown(
            category,
            "cooldownGlowSeconds",
            this.locale.getText("OPT_COOLDOWN_SECONDS"),
            this.locale.getText("TIP_COOLDOWN_SECONDS"),
            string.format("%d", this.settings.getDefault("cooldownGlowSeconds")),
            () => string.format("%d", this.settings.get("cooldownGlowSeconds")),
            (value) => this.settings.change("cooldownGlowSeconds", tonumber(value) ?? this.settings.getDefault("cooldownGlowSeconds")),
            () =>
                COOLDOWN_GLOW_CHOICES.map((seconds): [string, string] => [
                    string.format("%d", seconds),
                    seconds === 0 ? this.locale.getText("OPT_UNTIL_PRESSED") : string.format(this.locale.getText("OPT_SECONDS"), seconds),
                ]),
            true,
        );
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
