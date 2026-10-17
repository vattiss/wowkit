// The addon's page in the game's Settings panel: one main page, a list of controls. The page only reads and changes
// settings (SettingsService.change); whoever cares reacts to "setting.changed".
import type { OnFirstLogin } from "@wowkit/framework";
import type { MessagesService } from "./messages.service";

/** The page of an addon: it adds its controls to the layout. */
export interface OptionsPage {
    buildPage(category: SettingsCategory, layout: SettingsLayout): void;
}

export class OptionsService implements OnFirstLogin {
    private isRegistered = false;

    constructor(
        private readonly messages: MessagesService,
        /** The name of the addon in the Settings panel. */
        private readonly title: string,
        private readonly page: OptionsPage,
    ) {}

    /** Adds the page to the Settings panel at the first login; a failure is printed, never thrown. */
    onFirstLogin(): void {
        if (this.isRegistered || typeof Settings === "undefined") return;
        this.isRegistered = true;
        const [didSucceed, error] = pcall(() => this.registerPage());
        if (!didSucceed) this.messages.say(tostring(error));
    }

    private registerPage(): void {
        const [category, layout] = Settings.RegisterVerticalLayoutCategory(this.title);
        this.page.buildPage(category, layout);
        Settings.RegisterAddOnCategory(category);
    }
}
