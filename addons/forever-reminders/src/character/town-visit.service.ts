// Arriving in a town or an inn, where reagents are sold: name the ones that are running low.
import { OnGameEvent, type OnReady } from "@forever/framework";
import type { LocaleService } from "../locale/locale.service";
import type { MessagesService } from "../messages/messages.service";
import type { ReagentsService } from "../reminders/reagents.service";
import type { SettingsService } from "../settings/settings.service";
import type { NoticeService, PlayerService } from "@forever/wow";

export class TownVisitService implements OnReady {
    private wasResting = false;

    constructor(
        private readonly player: PlayerService,
        private readonly reagents: ReagentsService,
        private readonly settings: SettingsService,
        private readonly messages: MessagesService,
        private readonly notice: NoticeService,
        private readonly locale: LocaleService,
    ) {}

    onReady(): void {
        this.checkArrival();
    }

    /** Called at login and when the resting state changes. */
    @OnGameEvent("PLAYER_UPDATE_RESTING")
    checkArrival(): void {
        const isRestingNow = this.player.isResting();
        const hasArrived = isRestingNow && !this.wasResting;
        this.wasResting = isRestingNow;
        if (!hasArrived || !this.settings.get("showReagentNotice") || this.settings.get("isMuted")) return;
        const low = this.reagents.findLowReagents();
        if (low.length === 0) return;
        const names = low.map((stock) => `${stock.name} (${stock.count})`).join(", ");
        const message = string.format(this.locale.getText("NOTICE_REAGENTS_LOW"), names);
        this.messages.say(message);
        this.notice.showNotice(message);
    }
}
