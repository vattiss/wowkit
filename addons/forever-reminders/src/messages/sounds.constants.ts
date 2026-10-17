import type { TextKey } from "../locale/texts.constants";
import type { SoundKey } from "../settings/settings.interface";

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
