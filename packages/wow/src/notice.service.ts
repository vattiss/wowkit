// Sounds, chat lines and the on-screen notice.

import { attempt } from "./safe";

const NOTICE_SECONDS = 10;

export class NoticeService {
    private noticeFrame: Frame | undefined;
    private noticeText: FontString | undefined;
    private noticeToken = 0;

    /** Plays a sound by its SOUNDKIT name, or by `fallbackId` when the client has no such name. */
    playSound(kitName: string | undefined, fallbackId: number): void {
        const soundKitId = (kitName !== undefined ? SOUNDKIT[kitName] : undefined) ?? fallbackId;
        attempt(C_Sound.PlaySound, soundKitId, undefined, true);
    }

    /** A line in the chat window. */
    printToChat(text: string): void {
        print(text);
    }

    /**
     * A message in the upper middle of the screen for NOTICE_SECONDS. (UIErrorsFrame fades a message
     * after a second or two: too short to read.)
     */
    showNotice(text: string): void {
        if (!this.noticeFrame || !this.noticeText) {
            this.noticeFrame = CreateFrame("Frame", undefined, UIParent);
            this.noticeFrame.SetSize(700, 40);
            this.noticeFrame.SetPoint("TOP", UIParent, "TOP", 0, -180);
            this.noticeFrame.SetFrameStrata("HIGH");
            this.noticeText = this.noticeFrame.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
            this.noticeText.SetPoint("CENTER");
            this.noticeText.SetTextColor(1, 0.82, 0);
        }
        this.noticeText.SetText(text);
        this.noticeFrame.Show();
        this.noticeToken += 1;
        const token = this.noticeToken;
        C_Timer.After(NOTICE_SECONDS, () => {
            if (token === this.noticeToken) this.noticeFrame?.Hide();
        });
    }
}
