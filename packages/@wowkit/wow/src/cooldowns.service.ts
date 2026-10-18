// Spell cooldowns as the client tells them. In combat the client often hides them (secret values); the answer says so.
import { attempt, attemptMulti } from "./utils/protected-call.utils";
import { isReadable } from "./utils/secret-value.utils";

/** A cooldown read: seconds left and its full length; `isHidden` when the client did not tell. */
export interface CooldownRead {
    remain: number;
    duration: number;
    isHidden: boolean;
}

/** A cooldown this short is the global cooldown, not the spell's own. */
const GLOBAL_COOLDOWN = 1.51;

export class CooldownsService {
    /** The spell's cooldown now; the global cooldown alone counts as none. */
    readCooldown(spellId: number): CooldownRead {
        const info = attempt(C_Spell.GetSpellCooldown, spellId);
        if (info === undefined || type(info) !== "table") return { remain: 0, duration: 0, isHidden: true };
        const start = info.startTime;
        const duration = info.duration;
        if ((start !== undefined && !isReadable(start)) || (duration !== undefined && !isReadable(duration))) {
            return { remain: 0, duration: 0, isHidden: true };
        }
        const startAt = tonumber(start) ?? 0;
        const length = tonumber(duration) ?? 0;
        if (length > 0 && length <= GLOBAL_COOLDOWN) return { remain: 0, duration: length, isHidden: false };
        return { remain: math.max(length - (GetTime() - startAt), 0), duration: length, isHidden: false };
    }

    /** The spell's base cooldown in seconds, without the global cooldown; 0 when it has none or the client does not say. */
    getBaseCooldown(spellId: number): number {
        const [didSucceed, cooldown, gcd] = attemptMulti(() => GetSpellBaseCooldown(spellId));
        if (!didSucceed) return 0;
        return this.convertToSeconds(cooldown, gcd);
    }

    /** Milliseconds (or, from some clients, seconds) to seconds; a cooldown no longer than the global one is none. */
    private convertToSeconds(cooldown: unknown, gcd: unknown): number {
        const length = isReadable(cooldown) ? tonumber(cooldown) : undefined;
        const global = isReadable(gcd) ? tonumber(gcd) : undefined;
        if (length === undefined || length <= 0) return 0;
        if (length < 500) {
            const gcdSeconds = global !== undefined && global < 500 ? global : 1.5;
            return length <= gcdSeconds + 0.05 || length <= 1.5 ? 0 : length;
        }
        return length <= (global ?? 1500) + 50 ? 0 : length / 1000;
    }
}
