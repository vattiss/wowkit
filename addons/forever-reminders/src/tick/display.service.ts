// What the addon itself announces makes the glows and notices redraw.
import { OnEvent } from "@forever/framework";
import type { ShowRemindersService } from "./show-reminders.service";
import type { TickService } from "./tick.service";

export class DisplayService {
    constructor(
        private readonly shower: ShowRemindersService,
        private readonly ticker: TickService,
    ) {}

    @OnEvent("spellbook.indexed")
    redrawAfterSpellBook(): void {
        this.shower.markGlowsStale();
        this.ticker.tick();
    }

    @OnEvent("bars.mapped")
    redrawAfterBarsMapped(): void {
        this.shower.markGlowsStale();
    }

    @OnEvent("setting.changed")
    redrawAfterSettingChange(key: string): void {
        this.shower.redrawGlowsAfterSettingChange(key);
        this.ticker.tick();
    }
}
