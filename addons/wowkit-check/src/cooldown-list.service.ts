// What Blizzard's Cooldown Manager offers this class and spec, saved a moment after login, one line for each entry. Logging in
// on each class fills the list; it reaches the disk with a /reload or on logout.
import type { OnLogin } from "@wowkit/core";
import type { MessagesService } from "@wowkit/ui";
import type { ClockService, CooldownViewerService, PlayerService, SavedVariablesService } from "@wowkit/wow";

/** After login Blizzard is still loading its list. */
const SCAN_DELAY = 8;

export class CooldownListService implements OnLogin {
    constructor(
        private readonly viewer: CooldownViewerService,
        private readonly player: PlayerService,
        private readonly clock: ClockService,
        private readonly messages: MessagesService,
        private readonly savedVariables: SavedVariablesService,
    ) {}

    onLogin(): void {
        this.clock.runAfter(SCAN_DELAY, () => this.saveList());
    }

    /** Group|cooldown ID|spell ID|name|self=|aura=|hidden=|known=|linked names; the Group Buffs tab: group|spell ID|name|hidden=|known=. */
    private saveList(): void {
        const entries = this.viewer.listCatalog();
        const lines = entries.map((entry) =>
            [
                entry.category,
                entry.cooldownId,
                entry.spellId ?? "?",
                entry.names[0] ?? "?",
                `self=${tostring(entry.isOwnBuff)}`,
                `aura=${tostring(entry.hasAura)}`,
                `hidden=${tostring(entry.isHiddenByDefault)}`,
                `known=${tostring(entry.isKnown)}`,
                entry.names.slice(1).join(","),
            ].join("|"),
        );
        for (const buff of this.viewer.listGroupBuffs())
            lines.push(
                `group|${buff.spellId}|${buff.name ?? "?"}|hidden=${tostring(buff.isHiddenByDefault)}|known=${tostring(buff.isKnown)}`,
            );
        const key = `${this.player.getClassToken() ?? "?"}-${this.viewer.getSpecTag() ?? "?"}`;
        const saved = this.savedVariables.loadTable<Record<string, string[]>>() ?? {};
        saved[key] = lines;
        this.savedVariables.bindTable(saved);
        this.messages.say(`Cooldown Manager list of ${key}: ${lines.length} entries. Type /reload or log out to save it to disk.`);
    }
}
