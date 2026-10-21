// How the glows move: around the button (Blizzard's animation), breathing, or still; and, apart, the round buttons of
// Forever's gamepad bars, whose support is young (alpha).

import type { GlowStyle } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";
import type { ControlsService } from "@wowkit/ui";

/** The words of each style. */
const STYLE_TEXTS: { [style in GlowStyle]: TextKey } = {
    circling: "OPT_STYLE_CIRCLING",
    breathing: "OPT_STYLE_BREATHING",
    still: "OPT_STYLE_STILL",
};

export class GlowStyleSection {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
    ) {}

    addGlowStyleSection(category: SettingsCategory): void {
        this.addStyleDropdown(category, "glowStyle", "OPT_GLOW_STYLE", "TIP_GLOW_STYLE", ["circling", "breathing", "still"]);
        // A round button has no animation around it
        this.addStyleDropdown(category, "roundGlowStyle", "OPT_ROUND_GLOW_STYLE", "TIP_ROUND_GLOW_STYLE", ["breathing", "still"]);
    }

    private addStyleDropdown(
        category: SettingsCategory,
        key: "glowStyle" | "roundGlowStyle",
        label: TextKey,
        tip: TextKey,
        styles: GlowStyle[],
    ): void {
        this.controls.addDropdown(
            category,
            key,
            this.locale.getText(label),
            this.locale.getText(tip),
            this.settings.getDefault(key),
            () => this.settings.get(key),
            (value) =>
                this.settings.change(key, styles.includes(value as GlowStyle) ? (value as GlowStyle) : this.settings.getDefault(key)),
            () => styles.map((style): [string, string] => [style, this.locale.getText(STYLE_TEXTS[style])]),
            false,
        );
    }
}
