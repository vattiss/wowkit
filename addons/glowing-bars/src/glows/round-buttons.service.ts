// ConsolePort's crossbar buttons (CPB_...) are round, and it puts a round glow of its own on them; they say no shape the
// glow can take. Where the player wants it (a setting, off by default), they count as round, so they get the round glow
// of Forever's gamepad bars.
import { OnEvent, type OnFirstLogin } from "@wowkit/core";
import type { ButtonRegistryService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";

/** The start of the names of ConsolePort's crossbar buttons. */
const CONSOLEPORT_PREFIX = "CPB_";

export class RoundButtonsService implements OnFirstLogin {
    constructor(
        private readonly settings: AddonSettingsService,
        private readonly registry: ButtonRegistryService,
    ) {}

    onFirstLogin(): void {
        this.applySetting();
    }

    /** The setting changed (the glows are drawn again for it). */
    @OnEvent("setting.changed")
    applyChangedSetting(key: string): void {
        if (key === "areConsolePortButtonsRound") this.applySetting();
    }

    private applySetting(): void {
        this.registry.useRoundPrefixes(this.settings.get("areConsolePortButtonsRound") ? [CONSOLEPORT_PREFIX] : []);
    }
}
