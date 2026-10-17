// What the addon says and plays: chat lines in its name, and the alert sounds the player can pick.

import type { LocaleService } from "../locale/locale.service";
import type { SoundKey } from "../settings/settings.interface";
import type { NoticeService } from "@forever/wow";
import { SOUNDS } from "./sounds.constants";

export class MessagesService {
    constructor(
        private readonly notice: NoticeService,
        private readonly locale: LocaleService,
    ) {}

    playAlertSound(key: SoundKey): void {
        const choice = SOUNDS.find((sound) => sound.key === key);
        if (choice?.id === undefined) return;
        this.notice.playSound(choice.kit, choice.id);
    }

    /** A line in the chat window, in the addon's name. */
    say(message: string): void {
        this.notice.printToChat(`|cff66ccff${this.locale.getText("TITLE")}|r: ${message}`);
    }
}
