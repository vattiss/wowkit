// The game blocked something this addon did. The client's popup does not say which protected
// function was called; the event does.
import { OnGameEvent, contains } from "@forever/framework";
import type { LocaleService } from "../locale/locale.service";
import type { MessagesService } from "../messages/messages.service";
import type { SettingsService } from "../settings/settings.service";
import type { PlayerService } from "@forever/wow";

export class BlockedActionService {
    constructor(
        private readonly addonName: string,
        private readonly player: PlayerService,
        private readonly settings: SettingsService,
        private readonly messages: MessagesService,
        private readonly locale: LocaleService,
    ) {}

    @OnGameEvent("ADDON_ACTION_BLOCKED", "ADDON_ACTION_FORBIDDEN")
    noteBlockedAction(addon: unknown, action: unknown): void {
        const text = `${tostring(addon)} | ${tostring(action)}`;
        if (!contains(text, this.addonName)) return;
        const described = `${text} | ${this.player.isInCombat() ? "combat" : "no combat"}`;
        this.settings.write("blockedAction", described);
        this.messages.say(string.format(this.locale.getText("BLOCKED_ACTION"), described));
    }
}
