// Alert sounds and the on-screen notice.
import type { TextKey } from "./locale";
import type { SoundKey } from "./settings";
import { attempt } from "./util/safe";

export interface SoundChoice {
    key: SoundKey;
    label: TextKey;
    /** SOUNDKIT name, and the sound ID to fall back on. */
    kit?: string;
    id?: number;
}

/** The sounds the player can pick per reminder. The first entry is "no sound". */
export const SOUNDS: SoundChoice[] = [
    { key: "none", label: "SND_NONE" },
    { key: "ping", label: "SND_PING", kit: "MAP_PING", id: 3175 },
    { key: "ready", label: "SND_READY", kit: "READY_CHECK", id: 8960 },
    { key: "raidwarning", label: "SND_RAID", kit: "RAID_WARNING", id: 8959 },
    { key: "alarm", label: "SND_ALARM", kit: "ALARM_CLOCK_WARNING_3", id: 12889 },
    { key: "whisper", label: "SND_WHISPER", kit: "TELL_MESSAGE", id: 3081 },
    { key: "quest", label: "SND_QUEST", kit: "IG_QUEST_LIST_COMPLETE", id: 878 },
    { key: "toast", label: "SND_TOAST", kit: "UI_BNET_TOAST", id: 18019 },
    { key: "click", label: "SND_CLICK", kit: "IG_MAINMENU_OPTION_CHECKBOX_ON", id: 856 },
];

export function playAlertSound(key: SoundKey): void {
    const choice = SOUNDS.find((sound) => sound.key === key);
    if (choice?.id === undefined) return;
    const soundKitId = (choice.kit !== undefined ? SOUNDKIT[choice.kit] : undefined) ?? choice.id;
    attempt(C_Sound.PlaySound, soundKitId, undefined, true);
}

const NOTICE_SECONDS = 10;
let noticeFrame: Frame | undefined;
let noticeText: FontString | undefined;
let noticeToken = 0;

/**
 * A message in the upper middle of the screen for NOTICE_SECONDS. (UIErrorsFrame fades a message
 * after a second or two: too short to read.)
 */
export function showNotice(text: string): void {
    if (!noticeFrame || !noticeText) {
        noticeFrame = CreateFrame("Frame", undefined, UIParent);
        noticeFrame.SetSize(700, 40);
        noticeFrame.SetPoint("TOP", UIParent, "TOP", 0, -180);
        noticeFrame.SetFrameStrata("HIGH");
        noticeText = noticeFrame.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
        noticeText.SetPoint("CENTER");
        noticeText.SetTextColor(1, 0.82, 0);
    }
    noticeText.SetText(text);
    noticeFrame.Show();
    noticeToken += 1;
    const token = noticeToken;
    C_Timer.After(NOTICE_SECONDS, () => {
        if (token === noticeToken) noticeFrame?.Hide();
    });
}
