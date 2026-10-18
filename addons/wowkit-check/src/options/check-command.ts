// The slash command: /wowkit (or /wowkit check) checks the IDs of wow-data against the client.
import type { MessagesService } from "@wowkit/ui";
import type { IdCheckService } from "../id-check.service";

const COMMAND = "WOWKITCHECK";

export class CheckCommand {
    constructor(
        private readonly check: IdCheckService,
        private readonly messages: MessagesService,
    ) {}

    onAddonLoaded(): void {
        (_G as unknown as Record<string, unknown>)[`SLASH_${COMMAND}1`] = "/wowkit";
        SlashCmdList[COMMAND] = (text) => this.run(text);
    }

    private run(text: string): void {
        const [word] = string.match(string.lower(text), "^%s*(%S*)");
        if (word === "" || word === "check") this.check.checkIds();
        else this.messages.say("/wowkit or /wowkit check: ask the client about the IDs written in wow-data");
    }
}
