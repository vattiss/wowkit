// Building blocks for the Settings panel pages: a row with a button that puts a link in the chat box, ready to copy.
import { attempt } from "@wowkit/wow";
import type { MessagesService } from "./messages.service";

export class WidgetsService {
    constructor(
        private readonly messages: MessagesService,
        /** The text of the Copy button, and of the message after copying. */
        private readonly texts: { copy: string; copied: string },
    ) {}

    /** A row with a label and a Copy button; the button puts the URL in the chat box, highlighted, for Ctrl+C. */
    addLinkButton(layout: SettingsLayout, label: string, url: string): void {
        layout.AddInitializer(CreateSettingsButtonInitializer(label, this.texts.copy, () => this.copyText(url), url, false));
    }

    /** Puts the text in the chat box, highlighted, for Ctrl+C. */
    private copyText(text: string): void {
        const chat = ChatFrameUtil;
        const openChat = chat?.OpenChat;
        if (
            openChat &&
            attempt(() => {
                openChat(text, DEFAULT_CHAT_FRAME);
                return true;
            }) === true
        ) {
            DEFAULT_CHAT_FRAME.editBox?.HighlightText();
            this.messages.say(this.texts.copied);
            return;
        }
        const box = (chat?.ChooseBoxForSend ? chat.ChooseBoxForSend() : undefined) ?? DEFAULT_CHAT_FRAME.editBox;
        if (!box) {
            // No chat box to open: the link goes to the chat window itself, where it can be copied from
            this.messages.say(text);
            return;
        }
        if (chat?.ActivateChat) attempt(chat.ActivateChat, box);
        box.SetText(text);
        box.HighlightText();
        box.SetFocus();
        this.messages.say(this.texts.copied);
    }
}
