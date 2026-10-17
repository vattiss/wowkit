// One tick: look at the game, then show what is due. Runs every 0.2 seconds, and sooner when
// something happens (RefreshService asks for it).
import { Interval, type OnFirstLogin, type OnLogout, type OnReady } from "@wowkit/core";
import type { FindRemindersService } from "./find-reminders.service";
import type { ShowRemindersService } from "./show-reminders.service";

export class TickService implements OnFirstLogin, OnLogout, OnReady {
    private isRunning = false;

    constructor(
        private readonly finder: FindRemindersService,
        private readonly shower: ShowRemindersService,
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

    /** Looks at the game and shows what is due. Does nothing before the first login. */
    @Interval(200)
    tick(): void {
        if (!this.isRunning) return;
        this.shower.showReminders(this.finder.findReminders());
    }
}
