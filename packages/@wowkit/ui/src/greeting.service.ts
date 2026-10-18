// One line in the chat at login (not after a reload or a loading screen).
import type { OnLogin } from "@wowkit/core";
import type { MessagesService } from "./messages.service";

export class GreetingService implements OnLogin {
    constructor(
        private readonly messages: MessagesService,
        private readonly greeting: string,
    ) {}

    onLogin(): void {
        this.messages.say(this.greeting);
    }
}
