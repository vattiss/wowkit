// The notice at the top of the screen: one message with a line for each reminder that needs
// reading (missing buffs on no bar, party members missing a buff, spells at an old rank).

import type { LocaleService } from "../locale/locale.service";
import type { ActionBarsService } from "@forever/wow";
import type { ClockService } from "@forever/wow";
import type { NoticeService } from "@forever/wow";
import type { SpellsService } from "@forever/wow";
import type { Reminders } from "./tick.interface";

/** The same message is shown again only after this long. */
const NOTICE_REPEAT = 30;
/** After the bars changed they are mapped again; until then the old map would call every spell missing. */
const NOTICE_AFTER_BAR_CHANGE = 1.5;

interface Notice {
    /** Identifies the content: the same key means the same message. */
    key: string;
    lines: string[];
}

export class NoticesService {
    private lastNoticeKey: string | undefined;
    private lastNoticeAt = 0;

    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly clock: ClockService,
        private readonly notice: NoticeService,
        private readonly spells: SpellsService,
        private readonly locale: LocaleService,
    ) {}

    /** Shows the notice when its content is new, or when it has been a while since it was shown. */
    showNoticeIfNew(reminders: Reminders): void {
        if (this.actionBars.getSecondsSinceBarsChanged() <= NOTICE_AFTER_BAR_CHANGE) return;
        const notice = this.buildNotice(reminders);
        if (notice.lines.length === 0) {
            this.lastNoticeKey = undefined;
            return;
        }
        const now = this.clock.getCurrentTime();
        if (notice.key === this.lastNoticeKey && now - this.lastNoticeAt <= NOTICE_REPEAT) return;
        this.lastNoticeKey = notice.key;
        this.lastNoticeAt = now;
        this.notice.showNotice(notice.lines.join("\n"));
    }

    private buildNotice(reminders: Reminders): Notice {
        const keys: string[] = [];
        const lines: string[] = [];
        if (reminders.buffsNotOnBars.length > 0) {
            keys.push(`bar:${reminders.buffsNotOnBars.join(",")}`);
            const names = reminders.buffsNotOnBars.map((id) => this.spells.getSpellName(id) ?? "?").join(", ");
            lines.push(string.format(this.locale.getText("NOTICE_NOT_ON_BAR"), names));
        }
        for (const suggestion of reminders.partySuggestions) {
            const names = suggestion.names.join(", ");
            keys.push(`party:${suggestion.spellId}:${names}`);
            lines.push(string.format(this.locale.getText("NOTICE_PARTY"), this.spells.getSpellName(suggestion.spellId) ?? "?", names));
        }
        for (const rank of reminders.outdatedRanks) {
            keys.push(`${rank.id}:${rank.onBar}>${rank.best}`);
            lines.push(string.format(this.locale.getText("NOTICE_OLD_RANK"), rank.name, rank.onBar, rank.best));
        }
        return { key: keys.join(";"), lines };
    }
}
