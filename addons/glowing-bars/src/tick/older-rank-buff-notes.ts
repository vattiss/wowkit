// A line in the chat when a buff on the player is an older rank than the player knows: it is weaker, and in a fight Blizzard's
// Cooldown Manager does not follow it. Once for each time it is put on; a buff kept says nothing more. Only the chat, each of
// the two kinds (the player's own, another player's) with a switch of its own.
import { hasKnownExpiry, type ClockService } from "@wowkit/wow";
import type { MessagesService } from "@wowkit/ui";
import type { OlderRankBuff } from "../character/buff-state.service";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService } from "../settings/settings.interface";

/** A buff whose end moved later by more than this was put on again (cast anew), not merely read a moment later. */
const RECAST_SECONDS = 5;
/** The end of a buff without one (an Aspect): it is new only once it was gone. */
const NO_END = math.huge;

export class OlderRankBuffNotes {
    /** The older-rank buffs on the player at the last look, by spell ID: when each runs out. */
    private readonly seen = new LuaMap<number, number>();

    constructor(
        private readonly messages: MessagesService,
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly clock: ClockService,
    ) {}

    /** `buffs`: undefined when the addon did not look (a fight, idle): that says nothing of a buff being gone. */
    sayNew(buffs: OlderRankBuff[] | undefined): void {
        if (buffs === undefined) return;
        const now = this.clock.getCurrentTime();
        const present = new LuaSet<number>();
        for (const buff of buffs) {
            present.add(buff.spellId);
            const endsAt = hasKnownExpiry(buff.remain) ? now + buff.remain : NO_END;
            const before = this.seen.get(buff.spellId);
            this.seen.set(buff.spellId, endsAt);
            if (before !== undefined && endsAt <= before + RECAST_SECONDS) continue;
            this.say(buff);
        }
        // Gone, or replaced by another rank: put on again, it is new
        for (const [spellId] of this.seen) if (!present.has(spellId)) this.seen.delete(spellId);
    }

    private say(buff: OlderRankBuff): void {
        const isOwn = buff.caster === "player";
        if (!this.settings.get(isOwn ? "shouldNoteOwnOlderRankBuffs" : "shouldNoteOthersOlderRankBuffs")) return;
        const text = this.locale.getText(isOwn ? "CHAT_OLDER_RANK_OWN" : "CHAT_OLDER_RANK_OTHER");
        this.messages.say(string.format(text, buff.name, buff.rank, buff.best));
    }
}
