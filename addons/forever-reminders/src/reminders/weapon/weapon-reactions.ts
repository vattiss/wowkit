// What the weapon reminder does with a reading, by what the reading says. One small function for
// each: the buff is up, it is missing, the client did not say.
import { hasKnownExpiry } from "@forever/wow";
import type { WeaponBuff } from "./weapon-buff.interface";
import type { WeaponMemoryService } from "./weapon-memory.service";
import type { BuffReading, BuffStatus } from "./weapon-reading.service";

/** Weapon buffs warn this many seconds before they run out. */
export const EXPIRY_WARNING = 30;
/** A "missing" reading must hold this long before it is believed. */
export const MISSING_CONFIRM = 1.5;

export interface Reaction {
    /** Seconds left; 0 = missing. */
    remain: number;
    /** Remind now (missing, wrong, or about to run out). */
    isNeeded: boolean;
}

type Reactor = (memory: WeaponMemoryService, buff: WeaponBuff, reading: BuffReading, now: number) => Reaction;

/** The buff has a known end and it is near. */
export function isAboutToExpire(remain: number): boolean {
    return hasKnownExpiry(remain) && remain <= EXPIRY_WARNING;
}

function reactToDrop(memory: WeaponMemoryService): Reaction {
    memory.forgetSeen();
    return { remain: 0, isNeeded: true };
}

function reactToUp(memory: WeaponMemoryService, buff: WeaponBuff, reading: BuffReading, now: number): Reaction {
    memory.rememberSeen(now, hasKnownExpiry(reading.remain) ? reading.remain : buff.duration);
    return { remain: reading.remain, isNeeded: isAboutToExpire(reading.remain) };
}

function reactToMissing(memory: WeaponMemoryService, _buff: WeaponBuff, _reading: BuffReading, now: number): Reaction {
    // Past the grace after a cast, believe the client once the reading has held for a moment, even
    // if we "saw" the buff recently (removed by hand, or replaced)
    const missingSeconds = memory.noteMissing(now);
    if (!memory.isInGrace(now) && missingSeconds >= MISSING_CONFIRM) return reactToDrop(memory);
    if (memory.isInGrace(now) || memory.isSeenYet(now)) {
        const left = memory.getSecondsSeenLeft(now);
        return { remain: left, isNeeded: left > 0 && left <= EXPIRY_WARNING };
    }
    return reactToDrop(memory);
}

/** The client did not say: trust the grace time and what we saw last. */
function reactToUnknown(memory: WeaponMemoryService, _buff: WeaponBuff, _reading: BuffReading, now: number): Reaction {
    if (memory.isInGrace(now)) return { remain: 0, isNeeded: false };
    if (memory.isSeenYet(now)) {
        const left = memory.getSecondsSeenLeft(now);
        return { remain: left, isNeeded: left <= EXPIRY_WARNING };
    }
    return { remain: 0, isNeeded: true };
}

const REACTORS: { [status in BuffStatus]: Reactor } = {
    up: reactToUp,
    missing: reactToMissing,
    unknown: reactToUnknown,
};

export function reactToReading(memory: WeaponMemoryService, buff: WeaponBuff, reading: BuffReading, now: number): Reaction {
    if (reading.status !== "missing") memory.stopMissing();
    // The game said the enchant changed and it was not us: a drop is believed at once
    if (reading.status !== "up" && memory.takeExpectedDrop()) return reactToDrop(memory);
    return REACTORS[reading.status](memory, buff, reading, now);
}
