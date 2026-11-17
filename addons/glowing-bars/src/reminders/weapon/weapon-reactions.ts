// What the weapon reminder does with a reading, by what the reading says. One small function for
// each: the buff is up, it is missing, the client did not say. `before`: how many seconds before the buff runs out it is
// asked for again (its row's Before).
import { hasKnownExpiry } from "@wowkit/wow";
import type { WeaponBuff } from "./weapon-buff.interface";
import type { WeaponMemoryService } from "./weapon-memory.service";
import type { BuffReading, BuffStatus } from "./weapon-reading.service";

/** Weapon buffs warn this many seconds before they run out, unless their row's Before says another time. */
export const EXPIRY_WARNING = 30;
/** A "missing" reading must hold this long before it is believed. */
export const MISSING_CONFIRM = 1.5;

export interface Reaction {
    /** Seconds left; 0 = missing. */
    remain: number;
    /** Remind now (missing, wrong, or about to run out). */
    isNeeded: boolean;
}

type Reactor = (memory: WeaponMemoryService, buff: WeaponBuff, reading: BuffReading, now: number, before: number) => Reaction;

/** The buff has a known end, no more than `before` seconds away. */
export function isAboutToExpire(remain: number, before = EXPIRY_WARNING): boolean {
    return hasKnownExpiry(remain) && remain <= before;
}

function reactToDrop(memory: WeaponMemoryService): Reaction {
    memory.forgetSeen();
    return { remain: 0, isNeeded: true };
}

function reactToUp(memory: WeaponMemoryService, buff: WeaponBuff, reading: BuffReading, now: number, before: number): Reaction {
    memory.rememberSeen(now, hasKnownExpiry(reading.remain) ? reading.remain : buff.duration);
    return { remain: reading.remain, isNeeded: isAboutToExpire(reading.remain, before) };
}

function reactToMissing(memory: WeaponMemoryService, _buff: WeaponBuff, _reading: BuffReading, now: number, before: number): Reaction {
    // Past the grace after a cast, believe the client once the reading has held for a moment, even
    // if we "saw" the buff recently (removed by hand, or replaced)
    const missingSeconds = memory.noteMissing(now);
    if (!memory.isInGrace(now) && missingSeconds >= MISSING_CONFIRM) return reactToDrop(memory);
    if (memory.isInGrace(now) || memory.isSeenYet(now)) {
        const left = memory.getSecondsSeenLeft(now);
        return { remain: left, isNeeded: left > 0 && left <= before };
    }
    return reactToDrop(memory);
}

/** The client did not say: trust the grace time and what we saw last. */
function reactToUnknown(memory: WeaponMemoryService, _buff: WeaponBuff, _reading: BuffReading, now: number, before: number): Reaction {
    if (memory.isInGrace(now)) return { remain: 0, isNeeded: false };
    if (memory.isSeenYet(now)) {
        const left = memory.getSecondsSeenLeft(now);
        return { remain: left, isNeeded: left <= before };
    }
    return { remain: 0, isNeeded: true };
}

const REACTORS: { [status in BuffStatus]: Reactor } = {
    up: reactToUp,
    missing: reactToMissing,
    unknown: reactToUnknown,
};

export function reactToReading(
    memory: WeaponMemoryService,
    buff: WeaponBuff,
    reading: BuffReading,
    now: number,
    before = EXPIRY_WARNING,
): Reaction {
    if (reading.status !== "missing") memory.stopMissing();
    // The game said the enchant changed and it was not us: a drop is believed at once
    if (reading.status !== "up" && memory.takeExpectedDrop()) return reactToDrop(memory);
    return REACTORS[reading.status](memory, buff, reading, now, before);
}
