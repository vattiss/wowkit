// Putting the addon together: every service is made here, with the services it needs, dependencies first.
// The order of the lines is also the order the lifecycle hooks run in. The wiring is split in stages: Lua 5.1 lets a
// function reach at most 60 outer names, and one function naming every service would reach more.
import { IdleService } from "@forever-reminders/shared";
import { Addon } from "@wowkit/core";
import {
    AboutSection,
    ControlsService,
    GreetingService,
    LocaleService,
    MessagesService,
    OptionsService,
    SettingsService,
    WidgetsService,
} from "@wowkit/ui";
import {
    ActionBarsService,
    AurasService,
    BarRefreshService,
    CharacterService,
    ClockService,
    CooldownsService,
    GlowService,
    NoticeService,
    PlayerService,
    SavedVariablesService,
    SpellBookService,
    SpellCastService,
    SpellDetailsService,
    SpellRefreshService,
    SpellsService,
    TotemsService,
    UnitsService,
    ValueCurvesService,
} from "@wowkit/wow";
import { DefenseCueService } from "./cues/defense-cue.service";
import { EnemyCuesService } from "./cues/enemy-cues.service";
import { HiddenCuesService } from "./cues/hidden-cues.service";
import { RotationQueueService } from "./cues/rotation-queue.service";
import { SupportCuesService } from "./cues/support-cues.service";
import { NameKeysService } from "./knowledge/name-keys.service";
import { SpellTraitsService } from "./knowledge/spell-traits.service";
import { TEXTS } from "./locale/texts.constants";
import { HighlightsPage } from "./options/highlights.page";
import { SAVED_VARIABLES_NAME, createDefaultSettings, repairSettings } from "./settings/settings.constants";
import type { AddonSettings } from "./settings/settings.interface";
import { HealthService } from "./situation/health.service";
import { ListsService } from "./situation/lists.service";
import { RangeService } from "./situation/range.service";
import { RoleService } from "./situation/role.service";
import { TargetService } from "./situation/target.service";
import { AuraMemoryService } from "./state/aura-memory.service";
import { AuraReaderService } from "./state/aura-reader.service";
import { CastStateService } from "./state/cast-state.service";
import { ComboService } from "./state/combo.service";
import { CombatErrorsService } from "./state/combat-errors.service";
import { CooldownTrackerService } from "./state/cooldown-tracker.service";
import { HoldTrackerService } from "./state/hold-tracker.service";
import { LookAheadService } from "./state/look-ahead.service";
import { ShotTimingService } from "./state/shot-timing.service";
import { TotemTrackerService } from "./state/totem-tracker.service";
import { AuraChecksService } from "./steps/aura-checks.service";
import { PlayerChecksService } from "./steps/player-checks.service";
import { StepService } from "./steps/step.service";
import { TargetChecksService } from "./steps/target-checks.service";
import { TimingChecksService } from "./steps/timing-checks.service";
import { CastWatchService } from "./tick/cast-watch.service";
import { EventsService } from "./tick/events.service";
import { GlowsService } from "./tick/glows.service";
import { TickService } from "./tick/tick.service";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    const game = makeGame(addon, addonName);
    const texts = makeTexts(addon, game);
    const known = makeKnowledge(addon, game);
    const memory = makeMemory(addon, game, texts, known);
    const situation = makeSituation(addon, game, texts, known, memory);
    const steps = makeSteps(addon, game, known, memory, situation);
    makeTick(addon, game, texts, known, memory, situation, steps);
    makeOptions(addon, addonName, game, texts, situation);
    addon.start();
}

/** The game's door. */
function makeGame(addon: Addon, addonName: string) {
    const clock = addon.register(new ClockService());
    const player = addon.register(new PlayerService());
    const character = addon.register(new CharacterService());
    const units = addon.register(new UnitsService(player));
    const savedVariables = addon.register(new SavedVariablesService(SAVED_VARIABLES_NAME));
    const spellBook = addon.register(new SpellBookService(addon.events));
    const spells = addon.register(new SpellsService(spellBook, addon.events));
    addon.register(new SpellCastService(player, spells, addon.events));
    addon.register(new SpellRefreshService(spells, clock, addon.events));
    const details = addon.register(new SpellDetailsService());
    const cooldowns = addon.register(new CooldownsService());
    const auras = addon.register(new AurasService(spells));
    const totems = addon.register(new TotemsService());
    const curves = addon.register(new ValueCurvesService());
    const actionBars = addon.register(new ActionBarsService(clock, spells, addon.events));
    const barRefresh = addon.register(new BarRefreshService(actionBars, clock));
    const glow = addon.register(new GlowService(actionBars));
    const notice = addon.register(new NoticeService(addonName));
    return {
        clock,
        player,
        character,
        units,
        savedVariables,
        spells,
        details,
        cooldowns,
        auras,
        totems,
        curves,
        actionBars,
        barRefresh,
        glow,
        notice,
    };
}
type Game = ReturnType<typeof makeGame>;

/** Settings, texts and messages. */
function makeTexts(addon: Addon, game: Game) {
    const settings = addon.register(
        new SettingsService<AddonSettings>(game.savedVariables, addon.events, createDefaultSettings, repairSettings),
    );
    const locale = addon.register(new LocaleService(TEXTS));
    const messages = addon.register(new MessagesService(game.notice, locale.getText("TITLE")));
    addon.register(new GreetingService(messages, locale.getText("INIT")));
    return { settings, locale, messages };
}
type Texts = ReturnType<typeof makeTexts>;

/** What the addon knows about spells. */
function makeKnowledge(addon: Addon, game: Game) {
    const nameKeys = addon.register(new NameKeysService(game.spells));
    const traits = addon.register(new SpellTraitsService(game.spells, game.details, nameKeys));
    return { nameKeys, traits };
}
type Knowledge = ReturnType<typeof makeKnowledge>;

/** What the addon remembers: cooldowns, holds, combo points, auras, casts, errors, the shot timer, totems. */
function makeMemory(addon: Addon, game: Game, texts: Texts, known: Knowledge) {
    const { spells, units, clock, player } = game;
    const { nameKeys, traits } = known;
    const target = addon.register(new TargetService(units, player, game.character, clock));
    const cooldownTracker = addon.register(new CooldownTrackerService(spells, game.cooldowns, clock, nameKeys));
    const holds = addon.register(new HoldTrackerService(spells, units, clock, traits, nameKeys));
    const combo = addon.register(new ComboService(player, nameKeys));
    const lookAhead = addon.register(new LookAheadService(spells, nameKeys, combo, cooldownTracker));
    const memory = addon.register(new AuraMemoryService(spells, units, clock, nameKeys, holds));
    const auraReader = addon.register(new AuraReaderService(game.auras, spells, units, player, nameKeys, memory, lookAhead, target));
    const castState = addon.register(new CastStateService(player, spells, clock));
    const errors = addon.register(new CombatErrorsService(units, game.details, clock, addon.events));
    const shotTiming = addon.register(new ShotTimingService(player, units, spells, game.details, clock, texts.settings));
    const totemTracker = addon.register(new TotemTrackerService(game.totems, spells, player, clock, nameKeys, traits, auraReader));
    return { target, cooldownTracker, holds, combo, lookAhead, memory, auraReader, castState, errors, shotTiming, totemTracker };
}
type Memory = ReturnType<typeof makeMemory>;

/** The situation: the target, health, range, the role and the lists in use. */
function makeSituation(addon: Addon, game: Game, texts: Texts, known: Knowledge, memory: Memory) {
    const { spells, units, player, character, details } = game;
    const { target } = memory;
    const health = addon.register(new HealthService(units, character, spells, details, texts.settings));
    const range = addon.register(new RangeService(spells, details, units, player, game.actionBars, known.traits, health, target));
    const role = addon.register(new RoleService(player, character, texts.settings, target, range, memory.auraReader));
    const lists = addon.register(new ListsService(role, character, game.clock));
    return { target, health, range, role, lists };
}
type Situation = ReturnType<typeof makeSituation>;

/** Is a step offered now? */
function makeSteps(addon: Addon, game: Game, known: Knowledge, memory: Memory, situation: Situation) {
    const { spells, units, player, character, details } = game;
    const { target, health, range } = situation;
    const targetChecks = addon.register(new TargetChecksService(target, units, player, character, spells, range, health, memory.errors));
    const playerChecks = addon.register(
        new PlayerChecksService(
            player,
            character,
            units,
            spells,
            details,
            target,
            health,
            memory.auraReader,
            memory.combo,
            memory.totemTracker,
            memory.errors,
        ),
    );
    const auraChecks = addon.register(new AuraChecksService(memory.auraReader, memory.holds, player));
    const timingChecks = addon.register(
        new TimingChecksService(
            character,
            details,
            known.traits,
            health,
            memory.combo,
            memory.cooldownTracker,
            memory.holds,
            memory.castState,
        ),
    );
    return addon.register(
        new StepService(spells, details, units, known.traits, health, range, memory.cooldownTracker, memory.castState, memory.shotTiming, {
            target: targetChecks,
            player: playerChecks,
            aura: auraChecks,
            timing: timingChecks,
        }),
    );
}

/** The cues and the tick: find them, light them up, and look again sooner when something happens. */
function makeTick(addon: Addon, game: Game, texts: Texts, known: Knowledge, memory: Memory, situation: Situation, steps: StepService) {
    const { spells, units, player, details } = game;
    const { traits } = known;
    const { lists, range, target, health } = situation;
    const rotationQueue = addon.register(
        new RotationQueueService(
            spells,
            details,
            player,
            traits,
            lists,
            steps,
            range,
            target,
            memory.cooldownTracker,
            memory.castState,
            memory.lookAhead,
        ),
    );
    const hiddenCues = addon.register(new HiddenCuesService(spells, units, lists, steps, health, target, memory.combo, memory.castState));
    const defenseCue = addon.register(new DefenseCueService(spells, game.actionBars, lists, situation.role, steps));
    const enemyCues = addon.register(new EnemyCuesService(spells, units, game.auras, steps, range, situation.role, target));
    const supportCues = addon.register(
        new SupportCuesService(spells, units, game.auras, game.totems, traits, steps, situation.role, texts.settings),
    );
    const finders = { rotation: rotationQueue, hidden: hiddenCues, defense: defenseCue, enemy: enemyCues, support: supportCues };
    const idle = addon.register(new IdleService(player));
    const glows = addon.register(new GlowsService(game.glow, game.curves, texts.settings));
    const tick = addon.register(
        new TickService(texts.settings, idle, game.actionBars, game.character, game.clock, traits, health, finders, glows, texts.messages),
    );
    addon.register(
        new CastWatchService(
            game.auras,
            traits,
            health,
            memory.castState,
            memory.cooldownTracker,
            memory.holds,
            memory.combo,
            memory.memory,
            memory.totemTracker,
            rotationQueue,
            tick,
        ),
    );
    addon.register(
        new EventsService(game.auras, game.barRefresh, memory.combo, memory.memory, memory.holds, memory.totemTracker, rotationQueue, tick),
    );
}

/** The Settings panel. */
function makeOptions(addon: Addon, addonName: string, game: Game, texts: Texts, situation: Situation) {
    const { settings, locale, messages } = texts;
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
    const page = addon.register(new HighlightsPage(locale, settings, controls, game.player, situation.role, about));
    addon.register(new OptionsService(messages, locale.getText("TITLE"), page));
}
