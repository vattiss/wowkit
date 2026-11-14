// Putting the addon together, the stage of the shaman's totems (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Texts } from "./addon";
import type { Game } from "./game-services";
import { TotemGoneService } from "./reminders/totem-gone.service";

/** The totems that are gone, and their looks by element. */
export function makeTotemGone(addon: Addon, game: Game, texts: Texts): TotemGoneService {
    const totemGone = addon.register(
        new TotemGoneService(game.spells, game.actionBars, game.totems, texts.settings, game.clock, game.player),
    );
    texts.styles.useTotemLooks((spellId) => totemGone.findElementRow(spellId));
    return totemGone;
}
