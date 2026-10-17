// The addon's pages in the game's Settings panel. The first page is the landing page and the others go under
// it. The pages only read and change settings (SettingsService.change); whoever cares reacts to "setting.changed".
import type { OnFirstLogin } from "@wowkit/framework";
import type { MessagesService } from "./messages.service";

/** A page of the addon in the Settings panel. */
export interface OptionsPage {
    /** Adds the page: the first one to the panel (no parent), the others under the first one's category. */
    registerPage(parent: SettingsCategory | undefined): SettingsCategory;
}

export class OptionsService implements OnFirstLogin {
    private isRegistered = false;

    constructor(
        private readonly messages: MessagesService,
        private readonly pages: OptionsPage[],
    ) {}

    /** Adds the pages to the Settings panel at the first login; a failure is printed, never thrown. */
    onFirstLogin(): void {
        if (this.isRegistered || typeof Settings === "undefined") return;
        this.isRegistered = true;
        const [didSucceed, error] = pcall(() => this.registerPages());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    private registerPages(): void {
        let root: SettingsCategory | undefined;
        for (const page of this.pages) {
            const category = page.registerPage(root);
            root ??= category;
        }
    }
}
