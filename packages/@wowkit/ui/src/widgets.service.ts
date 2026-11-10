// Building blocks for the settings window: a row with a button, and one that puts a link in the chat box, ready to copy.
import { attempt } from "@wowkit/wow";
import type { MessagesService } from "./messages.service";
import { CONTROL_LEFT, type OptionRow, type OptionsTab } from "./options-tab";

export class WidgetsService {
    constructor(
        private readonly messages: MessagesService,
        /** The text of the Copy button, and of the message after copying. */
        private readonly texts: { copy: string; copied: string },
    ) {}

    /** A row with a label and a Copy button; the button puts the URL in the chat box, highlighted, for Ctrl+C. */
    addLinkButton(tab: OptionsTab, label: string, url: string): void {
        this.addButton(tab, label, this.texts.copy, () => this.copyText(url), url);
    }

    /** A row with a label and a button that does something. */
    addButton(tab: OptionsTab, label: string, buttonText: string, onClick: () => void, tooltip: string): OptionRow {
        const row = tab.createRow(label, tooltip);
        const button = CreateFrame("Button", undefined, row, "UIPanelButtonTemplate");
        button.SetSize(120, 22);
        button.SetPoint("LEFT", row, "LEFT", CONTROL_LEFT, 0);
        button.SetText(buttonText);
        button.SetScript("OnClick", () => onClick());
        return tab.addControl(row, { apply: () => onClick(), setEnabled: (isEnabled) => button.SetEnabled(isEnabled) });
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
