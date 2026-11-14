// When a reminder that is due shows: from the moment it became due (its own reason, and its When), for its glow time;
// then, where it repeats, again for its glow time every so many seconds. "Until done" (0) shows it the whole time it is
// due. An Alert in town repeats only in a town, and starts over on arriving in one. A ready cooldown counts from when it
// was ready, whether its When held then or not, and starts over only as its When begins (a "+ start" choice, a new target).
// One schedule for the glow, the message and the sound: they all come and go with what it lets through. A reminder held
// while it cannot be seen (a ready cooldown on a page of a bar not shown) keeps the time it has shown, and goes on from
// there when it is seen again.
import type { Style } from "../settings/settings.interface";

/** Seconds back a reminder that was due before the addon looked counts from: any glow time is over. */
const LONG_AGO = 100000;

export class GlowSchedule {
    /** When each reminder ("buff:21562") became due; one that is no longer due is forgotten, and starts over when back. */
    private dueSince = new LuaMap<string, number>();
    /** The reminders seen due in this tick. */
    private readonly seen = new LuaSet<string>();
    /** The time each held reminder had shown when it was last seen. */
    private readonly heldShownFor = new LuaMap<string, number>();

    /** A new tick: the reminders not seen due in the last one are over. */
    startTick(): void {
        for (const [key] of this.dueSince) {
            if (this.seen.has(key)) continue;
            this.dueSince.delete(key);
            this.heldShownFor.delete(key);
        }
        for (const key of this.seen) this.seen.delete(key);
    }

    /** The reminder is due but cannot be seen now: its time waits, and it is not forgotten. One never seen is left alone. */
    pause(key: string, now: number): void {
        const since = this.dueSince.get(key);
        if (since === undefined) return;
        this.seen.add(key);
        if (!this.heldShownFor.has(key)) this.heldShownFor.set(key, now - since);
    }

    /**
     * The ready cooldown was ready before the addon looked (a reload), or while the reminders kept quiet (mounted, in a town):
     * its time is long over, unless its When begins.
     */
    markShown(key: string, now: number): void {
        this.seen.add(key);
        if (!this.dueSince.has(key)) this.dueSince.set(key, now - LONG_AGO);
    }

    /**
     * The ready cooldown is due but its When does not hold now: its time runs on from when it was ready, so it does not
     * glow later, out of its time, as the When comes to hold (only a start of the When starts it over).
     */
    track(key: string, now: number): void {
        this.seen.add(key);
        if (!this.dueSince.has(key)) this.dueSince.set(key, now);
    }

    /** Does the due reminder show now? `isStartingOver`: its time starts again, as if it had just become due. */
    isShowing(key: string, style: Style, now: number, isInTown: boolean, isStartingOver: boolean): boolean {
        this.seen.add(key);
        const isTownAlert = style.when === "townAlert";
        let since = this.dueSince.get(key);
        const shownFor = this.heldShownFor.get(key);
        this.heldShownFor.delete(key);
        if (shownFor !== undefined && since !== undefined && !isStartingOver) {
            since = now - shownFor;
            this.dueSince.set(key, since);
        }
        if (since === undefined || isStartingOver) {
            since = now;
            this.dueSince.set(key, since);
        }
        if (style.glowTime === 0) return true;
        const elapsed = now - since;
        if (elapsed < style.glowTime) return true;
        const repeat = isTownAlert && !isInTown ? 0 : style.repeat;
        return repeat > 0 && elapsed % repeat < style.glowTime;
    }
}
