// The notice at the top of the screen that names the spells on the bars at an old rank.
import { Interval } from "@wowkit/framework";
import type { ActionBarsService, ClockService, NoticeService, PlayerService } from "@wowkit/wow";
import type { AddonLocale } from "./locale/locale.interface";
import type { AddonSettingsService } from "./settings/settings.interface";

/** The same message is shown again only after this long. */
const NOTICE_REPEAT = 30;
/** After the bars changed they are mapped again; until then the old map would call every spell old. */
const NOTICE_AFTER_BAR_CHANGE = 1.5;

export class RankNoticeService {
    /** Identifies the content of the message shown last: the same key means the same message. */
    private lastKey: string | undefined;
    private lastShownAt = 0;

    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly clock: ClockService,
        private readonly notice: NoticeService,
        private readonly player: PlayerService,
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
    ) {}

    /** Shows the notice when its content is new, or when it has been a while since it was shown. */
    @Interval(1000)
    showNoticeIfNew(): void {
        // Nothing while dead, mounted, eating or resting in town, or when the player muted the addon
        const isIdle = this.player.shouldStayIdle(this.settings.get("hideResting")) || this.settings.get("isMuted");
        const ranks = isIdle ? [] : this.actionBars.findOutdatedRanks();
        if (ranks.length === 0) {
            this.lastKey = undefined;
            return;
        }
        if (this.actionBars.getSecondsSinceBarsChanged() <= NOTICE_AFTER_BAR_CHANGE) return;
        const key = ranks.map((rank) => `${rank.id}:${rank.onBar}>${rank.best}`).join(";");
        const now = this.clock.getCurrentTime();
        if (key === this.lastKey && now - this.lastShownAt <= NOTICE_REPEAT) return;
        this.lastKey = key;
        this.lastShownAt = now;
        const lines = ranks.map((rank) => string.format(this.locale.getText("NOTICE_OLD_RANK"), rank.name, rank.onBar, rank.best));
        this.notice.showNotice(lines.join("\n"));
    }
}
