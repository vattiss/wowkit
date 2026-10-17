// Putting the addon together: every service is made here, with the services it needs, dependencies first.
// The order of the lines is also the order the lifecycle hooks run in.
/* eslint-disable max-lines-per-function -- the wiring is a list of `new` lines read top to bottom, not logic */
import { Addon } from "@wowkit/framework";
import { AuraWatchService } from "./character/aura-watch.service";
import { BlockedActionService } from "./character/blocked-action.service";
import { EquipmentService } from "./character/equipment.service";
import { RosterService } from "./character/roster.service";
import { DebugModeService } from "./diagnostics/debug-mode.service";
import { RecorderService } from "./diagnostics/recorder.service";
import { ReportService } from "./diagnostics/report.service";
import { SamplesService } from "./diagnostics/samples.service";
import { BuffKnowledgeService } from "./knowledge/buff-knowledge.service";
import { DebugPage } from "./options/debug.page";
import { RemindersPage } from "./options/reminders.page";
import { WeaponSection } from "./options/weapon.section";
import { BuffReminderService } from "./reminders/buff-reminder.service";
import { ClassBuffsService } from "./reminders/class-buffs.service";
import { PartyBuffsService } from "./reminders/party-buffs.service";
import {
    ReagentsService,
    BarRefreshService,
    SPELL_NAME_HINT,
    SpellRefreshService,
    ActionBarsService,
    AuraMemoryService,
    AurasService,
    BagsService,
    ClockService,
    GlowService,
    NoticeService,
    PartyService,
    PlayerService,
    SavedVariablesService,
    SpellBookService,
    SpellCastService,
    SpellsService,
    WeaponEnchantsService,
} from "@wowkit/wow";
import { WeaponChoiceService } from "./reminders/weapon/weapon-choice.service";
import { WeaponMemoryService } from "./reminders/weapon/weapon-memory.service";
import { WeaponReadingService } from "./reminders/weapon/weapon-reading.service";
import { WeaponReminderService } from "./reminders/weapon/weapon-reminder.service";
import { TEXTS } from "./locale/texts.constants";
import { ReminderControlsService } from "./options/reminder-controls.service";
import { SAVED_VARIABLES_NAME, createDefaultSettings } from "./settings/settings.constants";
import type { AddonSettings } from "./settings/settings.interface";
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
import { DisplayService } from "./tick/display.service";
import { FindRemindersService } from "./tick/find-reminders.service";
import { NoticesService } from "./tick/notices.service";
import { RefreshService } from "./tick/refresh.service";
import { ShowRemindersService } from "./tick/show-reminders.service";
import { TickService } from "./tick/tick.service";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    // The game's door, the settings, and what only this addon knows (the toolkit asks for these)
    const clock = addon.register(new ClockService());
    const player = addon.register(new PlayerService());
    const party = addon.register(new PartyService());
    const bags = addon.register(new BagsService());
    const savedVariables = addon.register(new SavedVariablesService(SAVED_VARIABLES_NAME));
    const spellBook = addon.register(new SpellBookService(addon.events));
    const spells = addon.register(new SpellsService(spellBook, addon.events, SPELL_NAME_HINT));
    addon.register(new SpellCastService(player, spells, addon.events));
    const settings = addon.register(new SettingsService<AddonSettings>(savedVariables, addon.events, createDefaultSettings));
    const classBuffs = addon.register(new ClassBuffsService(player, spells, settings));
    const buffKnowledge = addon.register(new BuffKnowledgeService(classBuffs));

    // Reading the player's buffs and the action bars
    const auraMemory = addon.register(new AuraMemoryService(spells, buffKnowledge));
    const auras = addon.register(new AurasService(spells, player, auraMemory, buffKnowledge));
    const actionBars = addon.register(new ActionBarsService(clock, spells, addon.events));
    addon.register(new SpellRefreshService(spells, clock, addon.events));
    const barRefresh = addon.register(new BarRefreshService(actionBars, clock));
    const weaponEnchants = addon.register(new WeaponEnchantsService());
    const glow = addon.register(new GlowService(actionBars));
    const notice = addon.register(new NoticeService());

    // Texts and messages
    const locale = addon.register(new LocaleService(TEXTS));
    const messages = addon.register(new MessagesService(notice, locale.getText("TITLE")));
    addon.register(new GreetingService(messages, locale.getText("INIT")));

    // What the addon reminds about
    const buffReminder = addon.register(new BuffReminderService(auras, spells, player, actionBars, classBuffs));
    const reagents = addon.register(new ReagentsService(bags, spells));
    const partyBuffs = addon.register(new PartyBuffsService(auras, spells, clock, party, player, classBuffs, reagents, settings));
    const weaponChoice = addon.register(new WeaponChoiceService(player, spells, settings));
    const weaponMemory = addon.register(new WeaponMemoryService());
    const weaponReading = addon.register(new WeaponReadingService(auras, weaponEnchants, weaponChoice));
    const weaponReminder = addon.register(new WeaponReminderService(clock, weaponEnchants, weaponChoice, weaponMemory, weaponReading));

    // The tick: find what is due, show it, look again sooner when something changed
    const findReminders = addon.register(
        new FindRemindersService(actionBars, player, spells, buffReminder, partyBuffs, weaponReminder, settings),
    );
    const notices = addon.register(new NoticesService(actionBars, clock, notice, spells, locale));
    const showReminders = addon.register(new ShowRemindersService(glow, messages, settings, notices));
    const tick = addon.register(new TickService(findReminders, showReminders));
    const refresh = addon.register(new RefreshService(tick, showReminders, auras, clock, barRefresh));
    addon.register(new DisplayService(showReminders, tick));

    // What happens to the player
    addon.register(new EquipmentService(refresh, player, weaponEnchants, weaponReminder));
    addon.register(new AuraWatchService(refresh, auras, weaponReminder));
    addon.register(new RosterService(refresh, partyBuffs));
    addon.register(new BlockedActionService(addonName, player, settings, messages, locale));

    // Debug mode and the debug report
    const recorder = addon.register(new RecorderService(settings, player));
    const samples = addon.register(
        new SamplesService(
            recorder,
            actionBars,
            party,
            player,
            spells,
            weaponEnchants,
            buffReminder,
            classBuffs,
            partyBuffs,
            reagents,
            weaponChoice,
            weaponReminder,
        ),
    );
    const report = addon.register(new ReportService(settings, recorder));
    addon.register(new DebugModeService(addonName, settings, clock, player, recorder, samples));

    // The Settings panel
    const controls = addon.register(new ControlsService<AddonSettings>(settings, messages, addonName));
    const widgets = addon.register(
        new WidgetsService(messages, { copy: locale.getText("INFO_COPY"), copied: locale.getText("INFO_COPIED") }),
    );
    const reminderControls = addon.register(new ReminderControlsService(controls, settings, locale));
    const weaponSection = addon.register(new WeaponSection(locale, spells, weaponChoice, settings, controls, reminderControls));
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
    const remindersPage = addon.register(
        new RemindersPage(locale, spells, classBuffs, settings, controls, reminderControls, weaponSection),
    );
    const debugPage = addon.register(new DebugPage(locale, messages, recorder, report, widgets));
    addon.register(new OptionsService(messages, [homePage, remindersPage, debugPage]));
    addon.start();
}
