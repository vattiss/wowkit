// The buff memory as the character's saved settings keep it through a /reload (see BuffMemorySaveService): plain tables of
// strings and numbers, so the game can write them to the file. The times are of GetTime, which counts on through a reload.

export interface BuffMemorySnapshot {
    /** Aura key -> when the memory runs out. */
    held: { [key: string]: number };
    /** Category key -> when the memory runs out. */
    categories: { [key: string]: number };
    /** Aura or category key -> when the player cast it. */
    castAt: { [key: string]: number };
    /** Aura key -> the buff's name. */
    names: { [key: string]: string };
    guessed: string[];
    unsure: string[];
    recorded: string[];
}

/** What is saved: the memory, the answers of the buffs each caster keeps one of (by spell ID), and when. */
export interface SavedBuffMemory {
    savedAt: number;
    memory: BuffMemorySnapshot;
    perCasterVerdicts: { [spellId: string]: boolean };
}

function isMapOf(value: unknown, kind: "number" | "string" | "boolean"): boolean {
    if (type(value) !== "table") return false;
    for (const [key, entry] of pairs(value as object)) if (type(key) !== "string" || type(entry) !== kind) return false;
    return true;
}

function isListOfStrings(value: unknown): boolean {
    return type(value) === "table" && (value as unknown[]).every((entry) => type(entry) === "string");
}

/** Is this what BuffMemorySaveService saved, every part as it should be? Anything else (an old file, one edited) is dropped. */
export function isSavedBuffMemory(value: unknown): value is SavedBuffMemory {
    if (type(value) !== "table") return false;
    const saved = value as Partial<SavedBuffMemory>;
    const memory = saved.memory as Partial<BuffMemorySnapshot> | undefined;
    if (type(saved.savedAt) !== "number" || memory === undefined || type(memory) !== "table") return false;
    if (!isMapOf(saved.perCasterVerdicts, "boolean")) return false;
    const areMapsRight = isMapOf(memory.held, "number") && isMapOf(memory.categories, "number") && isMapOf(memory.castAt, "number");
    const areListsRight = isListOfStrings(memory.guessed) && isListOfStrings(memory.unsure) && isListOfStrings(memory.recorded);
    return areMapsRight && areListsRight && isMapOf(memory.names, "string");
}
