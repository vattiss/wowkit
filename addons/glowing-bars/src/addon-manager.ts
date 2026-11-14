// Putting the addon together, the stage of Blizzard's Cooldown Manager (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Buffs, Reminders, Texts } from "./addon";
import { CooldownManagerService } from "./character/cooldown-manager.service";
import type { Game } from "./game-services";

/** Blizzard's Cooldown Manager, running in the background: what the addon reminds about goes on display in it. */
export function makeCooldownManager(addon: Addon, game: Game, texts: Texts, buffs: Buffs, reminders: Reminders) {
    addon.register(
        new CooldownManagerService(
            game.cooldownViewer,
            game.player,
            texts.settings,
            game.spells,
            game.clock,
            buffs.classBuffs,
            reminders.addedSpells,
            reminders.seal,
            reminders.tracking,
            reminders.glowCues,
            game.glow,
            game.buttonRegistry,
        ),
    );
}
