// Arriving in a town or an inn, where reagents are sold: name the ones that are running low (their glow, on the group
// buffs, is the finder's).
import { OnGameEvent, type OnReady } from "@wowkit/core";
import type { StyleService } from "../settings/style.service";
import type { MessagesService } from "@wowkit/ui";
import type { ReagentsService } from "../reagents/reagents.service";
import type { NoticeService, PlayerService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService } from "../settings/settings.interface";

export class TownVisitService implements OnReady {
    private wasResting = false;

    constructor(
        private readonly player: PlayerService,
        private readonly reagents: ReagentsService,
        private readonly settings: AddonSettingsService,
        private readonly messages: MessagesService,
        private readonly notice: NoticeService,
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
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
        if (!hasArrived || this.settings.get("isMuted") || !this.settings.get("showReagents")) return;
        const reagentOn = this.settings.get("reagentOn");
        const low = this.reagents.findLowReagents((reagent) => reagentOn[String(reagent.itemId)] !== false);
        if (low.length === 0) return;
        const names = low.map((stock) => `${stock.name} (${stock.count})`).join(", ");
        const message = string.format(this.locale.getText("NOTICE_REAGENTS_LOW"), names);
        this.messages.say(message);
        const style = this.styles.getStyle("reagent");
        if (style.isTextOn) this.notice.showNotice(this.styles.applyTextColor(style.color, message));
    }
}
