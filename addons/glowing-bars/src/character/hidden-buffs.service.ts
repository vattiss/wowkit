// Buffs the client may keep secret (in a dungeon, a raid, a fight): such an aura is left out of a list that looks whole, so
// its absence proves nothing, unless the buff was seen since the client last could start hiding it. What a buff's aura
// shows of how long it lasts is learned and kept per character, so one cast where it is hidden is followed to its end;
// cast there before that was ever seen, the chat says so once (a switch in the settings).
import type { MessagesService } from "@wowkit/ui";
import type { AuraSecrecyService, SecrecyAnswer } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService } from "../settings/settings.interface";

export class HiddenBuffsService {
    /** When each buff (by aura key) was last seen: the moment count then, and what C_Secrets said of it. */
    private readonly seen = new LuaMap<string, { phase: number; says: SecrecyAnswer }>();
    /** The buffs (by aura key) the chat already told about. */
    private readonly told = new LuaSet<string>();

    constructor(
        private readonly secrecy: AuraSecrecyService,
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly messages: MessagesService,
    ) {}

    /** Seen on the player now; `duration`: how long the player's own aura of it lasts in all, when it shows (another's may last longer). */
    noteSeen(spellId: number, key: string, duration: number | undefined): void {
        this.seen.set(key, { phase: this.secrecy.getSecrecyPhase(), says: this.secrecy.readSpellSecrecy(spellId) });
        if (duration !== undefined) this.recordDuration(key, duration);
    }

    /**
     * May its absence from a whole-looking list be the client keeping it secret? It may be secret now, and was not seen since
     * the client last could start hiding it (a fight, a zone, a change in what C_Secrets says).
     */
    isAbsenceDoubtful(spellId: number, key: string): boolean {
        if (!this.secrecy.isAuraSecret(spellId)) return false;
        const seen = this.seen.get(key);
        return seen === undefined || seen.phase !== this.secrecy.getSecrecyPhase() || seen.says !== this.secrecy.readSpellSecrecy(spellId);
    }

    /** May the client keep this buff's aura secret now? */
    isAuraSecret(spellId: number): boolean {
        return this.secrecy.isAuraSecret(spellId);
    }

    /** How long the buff lasts, as learned from its aura; undefined before that. */
    findLearnedSeconds(key: string): number | undefined {
        return this.settings.get("buffDurations")[key];
    }

    /** A buff cast where it is kept secret, its length never seen: the chat says once that its end is not reminded this time. */
    noteUnfollowed(key: string, name: string): void {
        if (this.told.has(key) || !this.settings.get("shouldNoteHiddenBuffs")) return;
        this.told.add(key);
        this.messages.say(string.format(this.locale.getText("CHAT_HIDDEN_BUFF"), name));
    }

    /** The length of the player's own aura, the last one seen: one aura of a name each, so it does not change at every look. */
    private recordDuration(key: string, duration: number): void {
        const seconds = math.floor(duration + 0.5);
        const durations = this.settings.get("buffDurations");
        if (durations[key] === seconds) return;
        this.settings.change("buffDurations", { ...durations, [key]: seconds });
        this.told.delete(key);
    }
}
