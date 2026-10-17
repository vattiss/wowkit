export type SoundKey = "none" | "ping" | "ready" | "raidwarning" | "alarm" | "whisper" | "quest" | "toast" | "click";

export interface SoundChoice {
    key: SoundKey;
    label: string;
    /** SOUNDKIT name, and the sound ID to fall back on. */
    kit?: string;
    id?: number;
}

/** The sounds the player can pick. The first entry is "no sound". */
export const SOUNDS: SoundChoice[] = [
    { key: "none", label: "No sound" },
    { key: "ping", label: "Map ping", kit: "MAP_PING", id: 3175 },
    { key: "ready", label: "Ready check", kit: "READY_CHECK", id: 8960 },
    { key: "raidwarning", label: "Raid warning", kit: "RAID_WARNING", id: 8959 },
    { key: "alarm", label: "Alarm clock", kit: "ALARM_CLOCK_WARNING_3", id: 12889 },
    { key: "whisper", label: "Whisper", kit: "TELL_MESSAGE", id: 3081 },
    { key: "quest", label: "Quest complete", kit: "IG_QUEST_LIST_COMPLETE", id: 878 },
    { key: "toast", label: "Toast", kit: "UI_BNET_TOAST", id: 18019 },
    { key: "click", label: "Click", kit: "IG_MAINMENU_OPTION_CHECKBOX_ON", id: 856 },
];
