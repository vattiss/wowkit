// Putting the addon together, the extras of the glows (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import { AfkRainbowService } from "./glows/afk-rainbow.service";
import { RoundButtonsService } from "./glows/round-buttons.service";
import type { Game } from "./game-services";
import type { AddonSettingsService } from "./settings/settings.interface";

/** The rainbow while the player is AFK, and ConsolePort's buttons counted as round where the player wants. */
export function makeGlowExtras(addon: Addon, game: Game, settings: AddonSettingsService): void {
    addon.register(new AfkRainbowService(game.buttonSearch, game.glow, game.clock, game.player, settings));
    addon.register(new RoundButtonsService(settings, game.buttonRegistry));
}
