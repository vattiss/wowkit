// Putting the addon together, the stage of the weapon buff (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Game } from "./game-services";
import type { BuffStateService } from "./character/buff-state.service";
import type { AddonSettingsService } from "./settings/settings.interface";
import { WeaponChoiceService } from "./reminders/weapon/weapon-choice.service";
import { WeaponMemoryService } from "./reminders/weapon/weapon-memory.service";
import { WeaponReadingService } from "./reminders/weapon/weapon-reading.service";
import { WeaponReminderService } from "./reminders/weapon/weapon-reminder.service";

/** Which weapon buff to keep up, what the game says of it, what was remembered of it, and the reminder made of them. */
export function makeWeapons(addon: Addon, game: Game, settings: AddonSettingsService, buffState: BuffStateService) {
    const weaponChoice = addon.register(new WeaponChoiceService(game.player, game.spells, settings, game.actionBars, game.bags));
    const weaponMemory = addon.register(new WeaponMemoryService());
    const weaponReading = addon.register(new WeaponReadingService(buffState, game.weaponEnchants, weaponChoice));
    const weapon = addon.register(new WeaponReminderService(game.clock, game.weaponEnchants, weaponChoice, weaponMemory, weaponReading));
    return { weaponChoice, weapon };
}
