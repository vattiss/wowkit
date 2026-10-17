// Putting the addon together: every service is made here, with the services it needs, dependencies first.
// The order of the lines is also the order the lifecycle hooks run in.
/* eslint-disable max-lines-per-function -- the wiring is a list of `new` lines read top to bottom, not logic */
import { Addon } from "@forever/framework";
import { AuraWatchService } from "./character/aura-watch.service";
import { BlockedActionService } from "./character/blocked-action.service";
import { EquipmentService } from "./character/equipment.service";
import { RosterService } from "./character/roster.service";
import { TownVisitService } from "./character/town-visit.service";
import { DebugModeService } from "./diagnostics/debug-mode.service";
import { RecorderService } from "./diagnostics/recorder.service";
import { ReportService } from "./diagnostics/report.service";
import { SamplesService } from "./diagnostics/samples.service";
import { BuffKnowledgeService } from "./knowledge/buff-knowledge.service";
import { SPELL_NAME_HINT } from "./knowledge/spell-name-hints.constants";
import { LocaleService } from "./locale/locale.service";
import { GreetingService } from "./messages/greeting.service";
import { MessagesService } from "./messages/messages.service";
import { ControlsService } from "./options/controls.service";
import { DebugPage } from "./options/debug.page";
import { HomePage } from "./options/home.page";
import { OptionsService } from "./options/options.service";
import { RemindersPage } from "./options/reminders.page";
import { WeaponSection } from "./options/weapon.section";
import { WidgetsService } from "./options/widgets.service";
import { BuffReminderService } from "./reminders/buff-reminder.service";
import { ClassBuffsService } from "./reminders/class-buffs.service";
import { PartyBuffsService } from "./reminders/party-buffs.service";
import { ReagentsService } from "./reminders/reagents.service";
import { WeaponChoiceService } from "./reminders/weapon/weapon-choice.service";
import { WeaponMemoryService } from "./reminders/weapon/weapon-memory.service";
import { WeaponReadingService } from "./reminders/weapon/weapon-reading.service";
import { WeaponReminderService } from "./reminders/weapon/weapon-reminder.service";
import { SAVED_VARIABLES_NAME } from "./settings/settings.constants";
import { SettingsService } from "./settings/settings.service";
import { DisplayService } from "./tick/display.service";
import { FindRemindersService } from "./tick/find-reminders.service";
import { GameDataService } from "./tick/game-data.service";
import { NoticesService } from "./tick/notices.service";
import { RefreshService } from "./tick/refresh.service";
import { ShowRemindersService } from "./tick/show-reminders.service";
import { TickService } from "./tick/tick.service";
import { ActionBarsService } from "@forever/wow";
import { AuraMemoryService } from "@forever/wow";
import { AurasService } from "@forever/wow";
import { BagsService } from "@forever/wow";
import { ClockService } from "@forever/wow";
import { GlowService } from "@forever/wow";
import { NoticeService } from "@forever/wow";
import { PartyService } from "@forever/wow";
import { PlayerService } from "@forever/wow";
import { SavedVariablesService } from "@forever/wow";
import { SpellBookService } from "@forever/wow";
import { SpellCastService } from "@forever/wow";
import { SpellsService } from "@forever/wow";
import { WeaponEnchantsService } from "@forever/wow";

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
    const settings = addon.register(new SettingsService(savedVariables, addon.events));
    const classBuffs = addon.register(new ClassBuffsService(player, spells, settings));
    const buffKnowledge = addon.register(new BuffKnowledgeService(classBuffs));

    // Reading the player's buffs and the action bars
    const auraMemory = addon.register(new AuraMemoryService(spells, buffKnowledge));
    const auras = addon.register(new AurasService(spells, player, auraMemory, buffKnowledge));
    const actionBars = addon.register(new ActionBarsService(clock, spells, addon.events));
    const weaponEnchants = addon.register(new WeaponEnchantsService());
    const glow = addon.register(new GlowService(actionBars));
    const notice = addon.register(new NoticeService());

    // Texts and messages
    const locale = addon.register(new LocaleService());
    const messages = addon.register(new MessagesService(notice, locale));
    addon.register(new GreetingService(messages, locale));

    // What the addon reminds about
    const buffReminder = addon.register(new BuffReminderService(auras, spells, player, actionBars, classBuffs));
    const reagents = addon.register(new ReagentsService(bags, spells));
    const partyBuffs = addon.register(new PartyBuffsService(auras, spells, clock, party, player, classBuffs, reagents, settings));
    const weaponChoice = addon.register(new WeaponChoiceService(player, spells, settings));
    const weaponMemory = addon.register(new WeaponMemoryService());
    const weaponReading = addon.register(new WeaponReadingService(auras, weaponEnchants, weaponChoice));
    const weaponReminder = addon.register(new WeaponReminderService(clock, weaponEnchants, weaponChoice, weaponMemory, weaponReading));

    // The tick: find what is due, show it, look again sooner when something changed
    addon.register(new GameDataService(spells, actionBars));
    const findReminders = addon.register(
        new FindRemindersService(actionBars, player, spells, buffReminder, partyBuffs, weaponReminder, settings),
    );
    const notices = addon.register(new NoticesService(actionBars, clock, notice, spells, locale));
    const showReminders = addon.register(new ShowRemindersService(glow, messages, settings, notices));
    const tick = addon.register(new TickService(findReminders, showReminders));
    const refresh = addon.register(new RefreshService(tick, showReminders, actionBars, auras, clock, spells));
    addon.register(new DisplayService(showReminders, tick));

    // What happens to the player
    addon.register(new EquipmentService(refresh, player, weaponEnchants, weaponReminder));
    addon.register(new AuraWatchService(refresh, auras, weaponReminder));
    addon.register(new RosterService(refresh, partyBuffs));
    addon.register(new TownVisitService(player, reagents, settings, messages, notice, locale));
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
    const controls = addon.register(new ControlsService(locale, settings, messages));
    const widgets = addon.register(new WidgetsService(locale, messages));
    const weaponSection = addon.register(new WeaponSection(locale, spells, weaponChoice, settings, controls));
    const homePage = addon.register(new HomePage(locale, widgets));
    const remindersPage = addon.register(new RemindersPage(locale, spells, classBuffs, settings, controls, weaponSection));
    const debugPage = addon.register(new DebugPage(locale, messages, recorder, report, widgets));
    addon.register(new OptionsService(messages, homePage, remindersPage, debugPage));
    addon.start();
}
