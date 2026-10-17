// One line in the chat at login (not after a reload or a loading screen).
import { type OnLogin } from "@forever/framework";
import type { LocaleService } from "../locale/locale.service";
import type { MessagesService } from "./messages.service";

export class GreetingService implements OnLogin {
    constructor(
        private readonly messages: MessagesService,
        private readonly locale: LocaleService,
    ) {}

    onLogin(): void {
        this.messages.say(this.locale.getText("INIT"));
    }
}
