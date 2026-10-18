export type SoundKey = "none" | "raidwarning" | "battlegroundstart" | "rolecheck" | "alarm1" | "alarm2" | "alarm3";

export interface SoundChoice {
    key: SoundKey;
    label: string;
    /** SOUNDKIT name, and the sound ID to fall back on. */
    kit?: string;
    id?: number;
}

/** Is this a sound of the list? A saved choice may be from a time the list was longer. */
export function isSoundKey(value: unknown): value is SoundKey {
    return SOUNDS.some((sound) => sound.key === value);
}

/** The sounds the player can pick. The first entry is "no sound". */
export const SOUNDS: SoundChoice[] = [
    { key: "none", label: "No sound" },
    { key: "raidwarning", label: "Raid warning", kit: "RAID_WARNING", id: 8959 },
    { key: "battlegroundstart", label: "Battleground start", kit: "UI_BATTLEGROUND_COUNTDOWN_FINISHED", id: 25478 },
    { key: "rolecheck", label: "Role check", kit: "LFG_ROLE_CHECK", id: 17317 },
    { key: "alarm1", label: "Alarm clock 1", kit: "ALARM_CLOCK_WARNING_1", id: 18871 },
    { key: "alarm2", label: "Alarm clock 2", kit: "ALARM_CLOCK_WARNING_2", id: 12867 },
    { key: "alarm3", label: "Alarm clock 3", kit: "ALARM_CLOCK_WARNING_3", id: 12889 },
];
