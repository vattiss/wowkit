// The notice at the top of the screen: one message with a line for each reminder that needs
// reading (missing buffs on no bar, party members missing a buff, spells at an old rank).
import { getSecondsSinceBarsChanged } from "../wow/action-bars";
import { getCurrentTime } from "../wow/clock";
import { showNotice } from "../wow/notice";
import { getSpellName } from "../wow/spells";
import { getText } from "../locale";
import type { Reminders } from "./find-reminders";

/** The same message is shown again only after this long. */
const NOTICE_REPEAT = 30;
/** After the bars changed they are mapped again; until then the old map would call every spell missing. */
const NOTICE_AFTER_BAR_CHANGE = 1.5;

let lastNoticeKey: string | undefined;
let lastNoticeAt = 0;

interface Notice {
    /** Identifies the content: the same key means the same message. */
    key: string;
    lines: string[];
}

function buildNotice(reminders: Reminders): Notice {
    const keys: string[] = [];
    const lines: string[] = [];
    if (reminders.buffsNotOnBars.length > 0) {
        keys.push(`bar:${reminders.buffsNotOnBars.join(",")}`);
        lines.push(string.format(getText("NOTICE_NOT_ON_BAR"), reminders.buffsNotOnBars.map((id) => getSpellName(id) ?? "?").join(", ")));
    }
    for (const suggestion of reminders.partySuggestions) {
        const names = suggestion.names.join(", ");
        keys.push(`party:${suggestion.spellId}:${names}`);
        lines.push(string.format(getText("NOTICE_PARTY"), getSpellName(suggestion.spellId) ?? "?", names));
    }
    for (const rank of reminders.outdatedRanks) {
        keys.push(`${rank.id}:${rank.onBar}>${rank.best}`);
        lines.push(string.format(getText("NOTICE_OLD_RANK"), rank.name, rank.onBar, rank.best));
    }
    return { key: keys.join(";"), lines };
}

/** Shows the notice when its content is new, or when it has been a while since it was shown. */
export function showNoticeIfNew(reminders: Reminders): void {
    if (getSecondsSinceBarsChanged() <= NOTICE_AFTER_BAR_CHANGE) return;
    const notice = buildNotice(reminders);
    if (notice.lines.length === 0) {
        lastNoticeKey = undefined;
        return;
    }
    const now = getCurrentTime();
    if (notice.key === lastNoticeKey && now - lastNoticeAt <= NOTICE_REPEAT) return;
    lastNoticeKey = notice.key;
    lastNoticeAt = now;
    showNotice(notice.lines.join("\n"));
}
