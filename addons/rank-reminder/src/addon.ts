// Putting the addon together: every service is made here, with the services it needs, dependencies first.
// The order of the lines is also the order the lifecycle hooks run in.
import { IdleService } from "@forever-reminders/shared";
import { Addon } from "@wowkit/core";
import {
    ControlsService,
    AboutSection,
    GreetingService,
    LocaleService,
    MessagesService,
    OptionsService,
    SettingsService,
    WidgetsService,
} from "@wowkit/ui";
import {
    ActionBarsService,
    BarRefreshService,
    ClockService,
    NoticeService,
    PlayerService,
    SavedVariablesService,
    SpellBookService,
    SpellRefreshService,
    SpellsService,
} from "@wowkit/wow";
import { TEXTS } from "./locale/texts.constants";
import { OutdatedRanksService } from "./outdated-ranks.service";
import { RankNoticeService } from "./rank-notice.service";
import { RemindersPage } from "./options/reminders.page";
import { SAVED_VARIABLES_NAME, createDefaultSettings, repairSettings } from "./settings/settings.constants";
import type { AddonSettings } from "./settings/settings.interface";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    // The game's door: the spells and the action bars
    const clock = addon.register(new ClockService());
    const player = addon.register(new PlayerService());
    const savedVariables = addon.register(new SavedVariablesService(SAVED_VARIABLES_NAME));
    const spellBook = addon.register(new SpellBookService(addon.events));
    const spells = addon.register(new SpellsService(spellBook, addon.events));
    addon.register(new SpellRefreshService(spells, clock, addon.events));
    const actionBars = addon.register(new ActionBarsService(clock, spells, addon.events));
    addon.register(new BarRefreshService(actionBars, clock));
    const notice = addon.register(new NoticeService(addonName));

    // Settings, texts and messages
    const settings = addon.register(
        new SettingsService<AddonSettings>(savedVariables, addon.events, createDefaultSettings, repairSettings),
    );
    const locale = addon.register(new LocaleService(TEXTS));
    const messages = addon.register(new MessagesService(notice, locale.getText("TITLE")));
    addon.register(new GreetingService(messages, locale.getText("INIT")));

    // What the addon does
    const idle = addon.register(new IdleService(player));
    const outdatedRanks = addon.register(new OutdatedRanksService(actionBars, spells));
    addon.register(new RankNoticeService(actionBars, outdatedRanks, clock, notice, idle, settings, locale, messages));

    // The Settings panel
    const controls = addon.register(new ControlsService<AddonSettings>(settings, messages, addonName));
    const widgets = addon.register(
        new WidgetsService(messages, { copy: locale.getText("INFO_COPY"), copied: locale.getText("INFO_COPIED") }),
    );
    const about = addon.register(
        new AboutSection(
            widgets,
            {
                header: locale.getText("HDR_ABOUT"),
                githubLabel: locale.getText("INFO_GITHUB"),
                issuesLabel: locale.getText("INFO_ISSUES"),
            },
            "https://github.com/vattiss/wowkit",
        ),
    );
    const remindersPage = addon.register(new RemindersPage(locale, settings, controls, about));
    addon.register(new OptionsService(messages, locale.getText("TITLE"), remindersPage));
    addon.start();
}
