// Which action bars glow: a switch for each of the eight bars of the game, all on by default. A player who keeps a big bar of
// cooldowns next to the character can have the glow there and not on the usual bars.

import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";
import type { ControlsService } from "@wowkit/ui";
import type { ReminderControlsService } from "./reminder-controls.service";

/** The bars of the game, numbered as Edit Mode numbers them. */
const BAR_COUNT = 8;

export class BarsSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly reminderControls: ReminderControlsService,
    ) {}

    addBarsSection(category: SettingsCategory, layout: SettingsLayout): void {
        this.reminderControls.addHeader(layout, "HDR_BARS");
        for (let bar = 1; bar <= BAR_COUNT; bar++) {
            const key = string.format("%d", bar);
            this.controls.addCheckbox(
                category,
                `bar_${key}`,
                string.format(this.locale.getText("OPT_BAR"), bar),
                this.locale.getText("TIP_BAR"),
                true,
                () => this.settings.get("barOff")[key] !== true,
                (isChecked) => this.setBarOn(key, isChecked),
            );
        }
    }

    /** Switches one bar on or off; the default (on) is not stored. */
    private setBarOn(key: string, isOn: boolean): void {
        const barOff = { ...this.settings.get("barOff") };
        barOff[key] = isOn ? undefined : true;
        this.settings.change("barOff", barOff);
    }
}
