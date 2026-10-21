// The notice at the top of the screen: one message with a short line for each kind of reminder whose message the player
// switched on, in the color of its glow. A line says what kind of reminder it is, not which spell; only a reminder with
// no button to glow (a buff on no bar, a party member) names what it is about.

import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { ColorKey } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import type { ActionBarsService, ClockService, NoticeService, Rgb, SpellsService } from "@wowkit/wow";
import type { Reminders } from "./tick.interface";

/** The same message is shown again only after this long. */
const NOTICE_REPEAT = 30;
/** After the bars changed they are mapped again; until then the old map would call every spell missing. */
const NOTICE_AFTER_BAR_CHANGE = 1.5;

interface Line {
    /** Identifies the content: the same key means the same line. */
    key: string;
    /** Already in its color. */
    text: string;
}

export class NoticesService {
    private lastNoticeKey: string | undefined;
    private lastNoticeAt = 0;

    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly clock: ClockService,
        private readonly notice: NoticeService,
        private readonly spells: SpellsService,
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
    ) {}

    /** Shows the notice when its content is new, or when it has been a while since it was shown. */
    showNoticeIfNew(reminders: Reminders): void {
        if (this.actionBars.getSecondsSinceBarsChanged() <= NOTICE_AFTER_BAR_CHANGE) return;
        const lines = this.listLines(reminders);
        if (lines.length === 0) {
            // What the message was about is over: it goes out at once, not when its time is up
            if (this.lastNoticeKey !== undefined) this.notice.clearNotice();
            this.lastNoticeKey = undefined;
            return;
        }
        const key = lines.map((line) => line.key).join(";");
        const now = this.clock.getCurrentTime();
        if (key === this.lastNoticeKey && now - this.lastNoticeAt <= NOTICE_REPEAT) return;
        this.lastNoticeKey = key;
        this.lastNoticeAt = now;
        this.notice.showNotice(lines.map((line) => line.text).join("\n"));
    }

    private listLines(reminders: Reminders): Line[] {
        const lines: Line[] = [];
        this.addKindLines(lines, "buff", reminders.buffsToCast, "TEXT_BUFF");
        this.addKindLines(
            lines,
            "weapon",
            [...(reminders.weaponSpell !== undefined ? [reminders.weaponSpell] : []), ...reminders.customWeaponSpells],
            "TEXT_WEAPON",
        );
        this.addKindLines(lines, "seal", reminders.seals, "TEXT_SEAL");
        this.addKindLines(lines, "tracking", reminders.trackings, "TEXT_TRACKING");
        this.addKindLines(lines, "cooldown", reminders.readyCooldowns, "TEXT_COOLDOWN");
        this.addKindLines(lines, "proc", reminders.procs, "TEXT_PROC");
        this.addKindLines(
            lines,
            "rank",
            reminders.outdatedRanks.map((rank) => rank.id),
            "TEXT_RANK",
        );
        for (const spellId of reminders.buffsNotOnBars) {
            const name = this.spells.getSpellName(spellId) ?? "?";
            this.addNamedLine(lines, spellId, `bar:${spellId}`, string.format(this.locale.getText("NOTICE_NOT_ON_BAR"), name));
        }
        for (const suggestion of reminders.partySuggestions) {
            const names = suggestion.names.join(", ");
            const spellName = this.spells.getSpellName(suggestion.spellId) ?? "?";
            const text = string.format(this.locale.getText("NOTICE_PARTY"), spellName, names);
            this.addNamedLine(lines, suggestion.spellId, `party:${suggestion.spellId}:${names}`, text);
        }
        return lines;
    }

    /** A line for a kind of reminder: one for each color its spells (whose message is on) are shown in. */
    private addKindLines(lines: Line[], kind: ColorKey, spellIds: number[], text: TextKey): void {
        const groups: { color: Rgb; ids: number[] }[] = [];
        for (const id of spellIds) {
            const style = this.styles.getStyle(kind, id);
            if (!style.isTextOn) continue;
            const group = groups.find((candidate) => candidate.color.join(",") === style.color.join(","));
            if (group === undefined) groups.push({ color: style.color, ids: [id] });
            else group.ids.push(id);
        }
        for (const group of groups) {
            lines.push({ key: `${kind}:${group.ids.join(",")}`, text: this.styles.applyTextColor(group.color, this.locale.getText(text)) });
        }
    }

    /** A line that names what it is about, in the buff color of the spell. */
    private addNamedLine(lines: Line[], spellId: number, key: string, text: string): void {
        const style = this.styles.getStyle("buff", spellId);
        if (style.isTextOn) lines.push({ key, text: this.styles.applyTextColor(style.color, text) });
    }
}
