// Putting the addon together, the stages of the reminders kept in files of their own (see addon.ts), as addon.ts is full:
// the totems gone, and the debuffs on the enemy targeted. Their reminders join the others.
import type { Addon } from "@wowkit/core";
import type { Texts } from "./addon";
import { makeTotemGone } from "./addon-totems";
import type { Game } from "./game-services";
import { DebuffMemoryService } from "./character/debuff-memory.service";
import type { AddedSpellsService } from "./glows/added-spells.service";
import { DebuffReminderService } from "./reminders/debuff-reminder.service";
import type { TotemGoneService } from "./reminders/totem-gone.service";

/** The reminders of the stages in files of their own: the totems gone, and the debuffs. */
export interface StageReminders {
    totemGone: TotemGoneService;
    debuffs: DebuffReminderService;
}

/** The reminders, with those of the stages in files of their own. */
export function addStageReminders<T extends { addedSpells: AddedSpellsService }>(
    addon: Addon,
    game: Game,
    texts: Texts,
    reminders: T,
): T & StageReminders {
    return { ...reminders, totemGone: makeTotemGone(addon, game, texts), debuffs: makeDebuffs(addon, game, texts, reminders.addedSpells) };
}

/** The added debuffs the target lacks: read where the game shows them, foreseen from the casts where it hides them. */
function makeDebuffs(addon: Addon, game: Game, texts: Texts, addedSpells: AddedSpellsService): DebuffReminderService {
    const { spells, player, clock } = game;
    const memory = addon.register(new DebuffMemoryService(addedSpells, spells, player, game.units, clock, texts.settings));
    const debuffs = addon.register(
        new DebuffReminderService(
            addedSpells,
            spells,
            game.actionBars,
            game.auras,
            game.auraSecrecy,
            player,
            clock,
            texts.settings,
            memory,
        ),
    );
    // How long before a debuff runs out it is asked for: its row's Before
    debuffs.useLooks(texts.styles);
    return debuffs;
}
