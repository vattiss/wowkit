// The wiring of the table of looks (/gb): its rows, its choices and edits, and the window. A part of addon.ts, kept apart to
// leave that file room; the wiring check reads both.
import type { Addon } from "@wowkit/core";
import { NoticeService } from "@wowkit/wow";
import type { Buffs, Reminders, Texts } from "./addon";
import type { Game } from "./game-services";
import { StyleChoicesService } from "./options/style-choices.service";
import { StyleEditsService } from "./options/style-edits.service";
import { StyleRowsService } from "./options/style-rows.service";
import { StyleTableService } from "./options/style-table.service";
import { StyleWindowService } from "./options/style-window.service";
import { EnabledService } from "./settings/enabled.service";

/** The table of looks (/gb), and its command. */
export function makeTable(addon: Addon, addonName: string, game: Game, texts: Texts, buffs: Buffs, reminders: Reminders) {
    const { locale, messages, styles } = texts;
    const rows = addon.register(
        new StyleRowsService(
            game.player,
            game.spells,
            buffs.classBuffs,
            reminders.weaponChoice,
            reminders.reagents,
            locale,
            styles,
            reminders.glowCues,
            reminders.addedSpells,
            reminders.seal,
            reminders.totem,
            reminders.tracking,
            reminders.fedBuffs,
        ),
    );
    const choices = addon.register(new StyleChoicesService(locale, styles, messages, texts.settings));
    const windows = addon.register(new StyleWindowService(locale, texts.settings));
    const switches = addon.register(new EnabledService(game.spells, buffs.classBuffs, reminders.reagents, texts.settings));
    const tableNotice = addon.register(new NoticeService(`${addonName}-table`));
    const edits = addon.register(
        new StyleEditsService(locale, reminders.addedSpells, tableNotice, switches, rows, styles, reminders.limits, reminders.reagents),
    );
    return addon.register(new StyleTableService(locale, styles, rows, messages, choices, windows, edits));
}
