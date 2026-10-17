// The addon's pages in the game's Settings panel: a landing page with the Reminders page and the
// Debug report page under it. The pages only read and change settings (SettingsService.change);
// whoever cares reacts to "setting.changed".
import { type OnFirstLogin } from "@forever/framework";
import type { MessagesService } from "../messages/messages.service";
import type { DebugPage } from "./debug.page";
import type { HomePage } from "./home.page";
import type { RemindersPage } from "./reminders.page";

export class OptionsService implements OnFirstLogin {
    private isRegistered = false;

    constructor(
        private readonly messages: MessagesService,
        private readonly homePage: HomePage,
        private readonly remindersPage: RemindersPage,
        private readonly debugPage: DebugPage,
    ) {}

    /** Adds the pages to the Settings panel at the first login; a failure is printed, never thrown. */
    onFirstLogin(): void {
        if (this.isRegistered || typeof Settings === "undefined") return;
        this.isRegistered = true;
        const [didSucceed, error] = pcall(() => this.registerPages());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    private registerPages(): void {
        const root = this.homePage.registerHomePage();
        this.remindersPage.registerRemindersPage(root);
        this.debugPage.registerDebugPage(root);
    }
}
