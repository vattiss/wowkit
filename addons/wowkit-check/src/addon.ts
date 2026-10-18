// Putting the addon together: every service is made here, with the services it needs, dependencies first.
import { Addon } from "@wowkit/core";
import { MessagesService } from "@wowkit/ui";
import { BagsService, ClockService, NoticeService, SavedVariablesService, SpellBookService, SpellsService } from "@wowkit/wow";
import { IdCheckService } from "./id-check.service";
import { CheckCommand } from "./options/check-command";

export const SAVED_VARIABLES_NAME = "WowkitCheckDB";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    const clock = addon.register(new ClockService());
    const bags = addon.register(new BagsService());
    const savedVariables = addon.register(new SavedVariablesService(SAVED_VARIABLES_NAME));
    const spellBook = addon.register(new SpellBookService(addon.events));
    const spells = addon.register(new SpellsService(spellBook, addon.events));
    const notice = addon.register(new NoticeService(addonName));
    const messages = addon.register(new MessagesService(notice, "Wowkit Check"));

    const check = addon.register(new IdCheckService(spells, bags, clock, messages, savedVariables));
    addon.register(new CheckCommand(check, messages));
    addon.start();
}
