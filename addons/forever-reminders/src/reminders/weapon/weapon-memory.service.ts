// What the weapon reminder remembers: the client's weapon enchant reads lag behind casts and are
// sometimes missing, so the reminder keeps a small timeline of its own.

import type { WeaponBuff } from "./weapon-buff.interface";

/** After a cast, a missing reading is ignored this long (the enchant is still landing). */
const CAST_GRACE = 3;
/** An enchant change this soon after our own cast is that cast, not a drop. */
const CAST_ENCHANT_WINDOW = 8;

export type Hand = "main" | "off";

export class WeaponMemoryService {
    private graceUntil = 0;
    private castAt = 0;
    /** The buff counts as up until then (seen, or cast, plus its duration). */
    private seenUntil = 0;
    /** A WEAPON_ENCHANT_CHANGED we did not cause: believe the next drop at once. */
    private shouldRecheckDrop = false;
    private missingSince: number | undefined;
    /** Two-weapon mode: per hand. */
    private readonly handMissingSince = new LuaMap<Hand, number>();

    /** The player put the buff on (a cast, or an enchant change while the buff was wanted). */
    rememberApply(buff: WeaponBuff, now: number): void {
        this.graceUntil = now + CAST_GRACE;
        this.castAt = now;
        this.seenUntil = now + buff.duration;
        this.shouldRecheckDrop = false;
    }

    /** The buff was seen on the weapon, for `secondsLeft` more (or for its whole duration). */
    rememberSeen(now: number, secondsLeft: number): void {
        this.shouldRecheckDrop = false;
        this.seenUntil = now + secondsLeft;
        this.graceUntil = 0;
    }

    /** What was seen or cast is no longer believed. */
    forgetSeen(): void {
        this.seenUntil = 0;
        this.graceUntil = 0;
    }

    /** A different weapon was equipped: what we remembered is about the old one. */
    forgetAll(): void {
        this.graceUntil = 0;
        this.seenUntil = 0;
        this.castAt = 0;
        this.shouldRecheckDrop = false;
    }

    /** Within the grace time after a cast. */
    isInGrace(now: number): boolean {
        return now < this.graceUntil;
    }

    /** The buff was seen or cast, and should still be on. */
    isSeenYet(now: number): boolean {
        return now < this.seenUntil;
    }

    getSecondsSeenLeft(now: number): number {
        return math.max(this.seenUntil - now, 0);
    }

    /** An enchant change right after our own cast is that cast. */
    isChangeOurOwn(now: number): boolean {
        return this.isInGrace(now) || (this.castAt > 0 && now - this.castAt < CAST_ENCHANT_WINDOW);
    }

    /** The enchant changed and it was not us: the next missing reading is believed at once. */
    expectDrop(): void {
        this.shouldRecheckDrop = true;
    }

    /** True once after expectDrop. */
    takeExpectedDrop(): boolean {
        const wasExpected = this.shouldRecheckDrop;
        this.shouldRecheckDrop = false;
        return wasExpected;
    }

    /** The buff is missing now; how many seconds has it been missing? */
    noteMissing(now: number): number {
        this.missingSince ??= now;
        return now - this.missingSince;
    }

    stopMissing(): void {
        this.missingSince = undefined;
    }

    /** A hand is missing its buff now; how many seconds has it been missing? */
    noteHandMissing(hand: Hand, now: number): number {
        const since = this.handMissingSince.get(hand) ?? now;
        this.handMissingSince.set(hand, since);
        return now - since;
    }

    stopHandMissing(hand: Hand): void {
        this.handMissingSince.delete(hand);
    }
}
