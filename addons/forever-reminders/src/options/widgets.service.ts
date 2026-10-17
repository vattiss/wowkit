// Building blocks for the custom (canvas) pages: a button, and a row with a link the player can copy.

import type { LocaleService } from "../locale/locale.service";
import type { TextKey } from "../locale/texts.constants";
import type { MessagesService } from "../messages/messages.service";
import { attempt } from "@forever/wow";

export class WidgetsService {
    constructor(
        private readonly locale: LocaleService,
        private readonly messages: MessagesService,
    ) {}

    createButton(parent: Frame, width: number, height: number, label: string): Button {
        const created = CreateFrame("Button", undefined, parent, "UIPanelButtonTemplate");
        created.SetSize(width, height);
        created.SetText(label);
        return created;
    }

    /** A label, a read-only box with the URL and a Copy button. */
    createLinkRow(parent: Frame, label: TextKey, url: string): Frame {
        const row = CreateFrame("Frame", undefined, parent);
        row.SetHeight(26);
        const text = row.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        text.SetPoint("LEFT", 0, 0);
        text.SetWidth(90);
        text.SetJustifyH("LEFT");
        text.SetTextColor(0.92, 0.92, 0.92);
        text.SetText(this.locale.getText(label));
        const box = CreateFrame("EditBox", undefined, row, "BackdropTemplate") as EditBox & BackdropFrame;
        box.SetPoint("LEFT", text, "RIGHT", 8, 0);
        box.SetPoint("RIGHT", -72, 0);
        box.SetHeight(22);
        box.SetAutoFocus(false);
        box.SetFontObject("ChatFontSmall");
        box.SetTextInsets(6, 6, 2, 2);
        box.SetText(url);
        box.SetCursorPosition(0);
        box.SetBackdrop({
            bgFile: "Interface\\Buttons\\WHITE8x8",
            edgeFile: "Interface\\Tooltips\\UI-Tooltip-Border",
            tile: true,
            tileSize: 8,
            edgeSize: 8,
            insets: { left: 2, right: 2, top: 2, bottom: 2 },
        });
        box.SetBackdropColor(0.08, 0.08, 0.08, 0.95);
        box.SetBackdropBorderColor(0.42, 0.42, 0.42, 1);
        box.SetScript("OnEditFocusGained", (self) => self.HighlightText());
        box.SetScript("OnEscapePressed", (self) => self.ClearFocus());
        box.SetScript("OnEnterPressed", (self) => self.ClearFocus());
        const copy = this.createButton(row, 64, 22, this.locale.getText("INFO_COPY"));
        copy.SetPoint("RIGHT", 0, 0);
        copy.SetScript("OnClick", () => {
            if (!this.copyText(url)) {
                box.SetFocus();
                box.HighlightText();
            }
        });
        return row;
    }

    /** Puts the text in the chat box, highlighted, for Ctrl+C. */
    private copyText(text: string): boolean {
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
            this.messages.say(this.locale.getText("INFO_COPIED"));
            return true;
        }
        const box = (chat?.ChooseBoxForSend ? chat.ChooseBoxForSend() : undefined) ?? DEFAULT_CHAT_FRAME.editBox;
        if (!box) return false;
        if (chat?.ActivateChat) attempt(chat.ActivateChat, box);
        box.SetText(text);
        box.HighlightText();
        box.SetFocus();
        this.messages.say(this.locale.getText("INFO_COPIED"));
        return true;
    }
}
