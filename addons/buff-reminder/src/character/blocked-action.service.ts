// The game blocked something this addon did. The client's popup does not say which protected
// function was called; the event does.
import { OnGameEvent, contains } from "@wowkit/framework";
import type { AddonLocale } from "../locale/locale.interface";
import type { MessagesService } from "@wowkit/ui";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { PlayerService } from "@wowkit/wow";

export class BlockedActionService {
    constructor(
        private readonly addonName: string,
        private readonly player: PlayerService,
        private readonly settings: AddonSettingsService,
        private readonly messages: MessagesService,
        private readonly locale: AddonLocale,
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
