// One tick: look at the game, then show what is due. Runs every 0.5 seconds in combat and every second out of it, and
// sooner when something happens (RefreshService asks for it). Between the two, each reminder found shows only when its look
// says it may (the When column of the table): always, in combat, out of combat, with a living enemy, ally or anyone targeted, or (the low
// reagents and stock) in a town or an inn; and then for its glow time, again with its repeat (GlowSchedule). What is due
// is the finders' to say; when it shows is the player's, for each type and spell.
// A tick makes as few new tables as it can (each one is memory the game has to clear later): the filtered reminders go into
// the same lists every time, and the tests the filter asks are made once.
import { Interval, type OnFirstLogin, type OnLogout, type OnReady } from "@wowkit/core";
import type { ClockService, PlayerService } from "@wowkit/wow";
import type { CooldownType, ReminderType } from "../settings/settings.interface";
import { COOLDOWN_TYPES } from "../settings/settings.constants";
import type { StyleService } from "../settings/style.service";
import type { FindRemindersService } from "./find-reminders.service";
import type { ShowRemindersService } from "./show-reminders.service";
import type { Reminders } from "./tick.interface";
import { createNoStarts, createWhenState, readWhenStarts, readWhenState } from "./when-state";
import { createEmptyReminders, filterReminders } from "./reminder-filter";
import { GlowSchedule } from "./glow-schedule";

/** Out of combat, a tick on the clock waits until this long after the last one (the clock comes every 0.5 seconds). */
const QUIET_TICK_SECONDS = 0.9;

type IsShown = (this: void, reminderType: ReminderType, id: number) => boolean;

export class TickService implements OnFirstLogin, OnLogout, OnReady {
    private isRunning = false;
    /** When each due reminder shows: its glow time and repeat. */
    private readonly schedule = new GlowSchedule();
    /** Was the player in a town at the last tick: arriving, an Alert in town starts over. */
    private wasInTown = false;
    private lastTickAt = 0;
    /** What the filter of this tick asks: the When that holds, the time and the town. */
    private readonly whenState = createWhenState();
    /** The When of the last tick, and the ones that began since: a ready cooldown starts over as its When begins. */
    private readonly wasWhenState = createWhenState();
    private readonly whenStarts = createNoStarts();
    private time = 0;
    private isInTown = false;
    private hasArrivedInTown = false;
    /** The reminders the When lets through, then the ones that show now: the same lists at every tick. */
    private readonly byWhen = createEmptyReminders();
    private readonly showing = createEmptyReminders();

    constructor(
        private readonly finder: FindRemindersService,
        private readonly shower: ShowRemindersService,
        private readonly player: PlayerService,
        private readonly styles: StyleService,
        private readonly clock: ClockService,
    ) {}

    onFirstLogin(): void {
        this.isRunning = true;
    }

    onLogout(): void {
        this.isRunning = false;
    }

    onReady(): void {
        this.tick();
    }

    /** A tick on the clock. Out of combat fewer are needed: what must come at once (procs, ready cooldowns) comes in combat. */
    @Interval(500)
    tickOnClock(): void {
        if (!this.player.isInCombat() && this.clock.getCurrentTime() - this.lastTickAt < QUIET_TICK_SECONDS) return;
        this.tick();
    }

    /** Looks at the game and shows what is due, when its look says it may. Does nothing before the first login. */
    tick(): void {
        if (!this.isRunning) return;
        this.lastTickAt = this.clock.getCurrentTime();
        this.shower.showReminders(this.filterShowing(this.finder.findReminders()));
    }

    /**
     * The reminders that may show now: by the When of their look, then by its glow time and repeat; the others are left
     * out, glow, message and sound alike.
     */
    private filterShowing(reminders: Reminders): Reminders {
        const now = readWhenState(this.player, this.whenState);
        filterReminders(this.byWhen, reminders, this.isAllowedNow);
        this.time = this.clock.getCurrentTime();
        this.isInTown = this.player.isResting();
        this.hasArrivedInTown = this.isInTown && !this.wasInTown;
        this.wasInTown = this.isInTown;
        readWhenStarts(now, this.wasWhenState, this.whenStarts);
        this.schedule.startTick();
        this.trackCooldowns("readyCooldown", reminders.readyCooldowns, reminders.pagedAwayCooldowns);
        this.trackCooldowns("utilityCooldown", reminders.utilityCooldowns, reminders.pagedAwayUtilityCooldowns);
        filterReminders(this.showing, this.byWhen, this.isDueNow);
        this.showing.isInTown = this.isInTown;
        return this.showing;
    }

    /**
     * The glow time of the ready cooldowns that do not show now. One on a page not shown keeps the time it has had: it does
     * not start over when it is back. One whose When does not hold counts its time all the same: it does not glow later,
     * out of its time.
     */
    private trackCooldowns(cooldownType: CooldownType, ready: number[], pagedAway: number[]): void {
        for (const id of pagedAway) {
            if (this.isAllowedNow(cooldownType, id)) this.schedule.pause(`${cooldownType}:${id}`, this.time);
            else this.schedule.track(`${cooldownType}:${id}`, this.time);
        }
        for (const id of ready) {
            if (!this.isAllowedNow(cooldownType, id)) this.schedule.track(`${cooldownType}:${id}`, this.time);
        }
    }

    /** Does the When of the reminder's look hold now? */
    private readonly isAllowedNow: IsShown = (reminderType, id) => this.whenState[this.styles.getStyle(reminderType, id).when];

    /** Does the reminder show now, by its glow time and repeat? */
    private readonly isDueNow: IsShown = (reminderType, id) => {
        const style = this.styles.getStyle(reminderType, id);
        const isStartingOver =
            (style.when === "townAlert" && this.hasArrivedInTown) ||
            (COOLDOWN_TYPES.includes(reminderType as CooldownType) && this.whenStarts[style.when]);
        return this.schedule.isShowing(`${reminderType}:${id}`, style, this.time, this.isInTown, isStartingOver);
    };
}
