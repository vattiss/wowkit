// Putting the addon together: every service is made here, with the services it needs, dependencies first.
// The order of the lines is also the order the lifecycle hooks run in.
import { Addon } from "@wowkit/framework";
import {
    ControlsService,
    GreetingService,
    HomePage,
    LocaleService,
    MessagesService,
    OptionsService,
    SettingsService,
    WidgetsService,
} from "@wowkit/ui";
import {
    BagsService,
    ClockService,
    NoticeService,
    PlayerService,
    ReagentsService,
    SPELL_NAME_HINT,
    SavedVariablesService,
    SpellBookService,
    SpellRefreshService,
    SpellsService,
} from "@wowkit/wow";
import { TEXTS } from "./locale/texts.constants";
import { RemindersPage } from "./options/reminders.page";
import { SAVED_VARIABLES_NAME, createDefaultSettings } from "./settings/settings.constants";
import type { AddonSettings } from "./settings/settings.interface";
import { TownVisitService } from "./town-visit.service";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    // The game's door: the spells (to know which group buffs the player has) and the bags
    const clock = addon.register(new ClockService());
    const player = addon.register(new PlayerService());
    const bags = addon.register(new BagsService());
    const savedVariables = addon.register(new SavedVariablesService(SAVED_VARIABLES_NAME));
    const spellBook = addon.register(new SpellBookService(addon.events));
    const spells = addon.register(new SpellsService(spellBook, addon.events, SPELL_NAME_HINT));
    addon.register(new SpellRefreshService(spells, clock, addon.events));
    const reagents = addon.register(new ReagentsService(bags, spells));
    const notice = addon.register(new NoticeService());

    // Settings, texts and messages
    const settings = addon.register(new SettingsService<AddonSettings>(savedVariables, addon.events, createDefaultSettings));
    const locale = addon.register(new LocaleService(TEXTS));
    const messages = addon.register(new MessagesService(notice, locale.getText("TITLE")));
    addon.register(new GreetingService(messages, locale.getText("INIT")));

    // What the addon does
    addon.register(new TownVisitService(player, reagents, settings, messages, notice, locale));

    // The Settings panel
    const controls = addon.register(new ControlsService<AddonSettings>(settings, messages, addonName));
    const widgets = addon.register(
        new WidgetsService(messages, { copy: locale.getText("INFO_COPY"), copied: locale.getText("INFO_COPIED") }),
    );
    const homePage = addon.register(
        new HomePage(
            widgets,
            {
                title: locale.getText("TITLE"),
                text: locale.getText("OPT_HOME_TEXT"),
                help: locale.getText("OPT_HOME_HELP"),
                githubLabel: locale.getText("INFO_GITHUB"),
                issuesLabel: locale.getText("INFO_ISSUES"),
            },
            "https://github.com/vattiss/wowkit",
        ),
    );
    const remindersPage = addon.register(new RemindersPage(locale, settings, controls, reagents, player));
    addon.register(new OptionsService(messages, [homePage, remindersPage]));
    addon.start();
}
