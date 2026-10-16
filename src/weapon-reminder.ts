// Whether the weapon buff needs a reminder. The client's weapon enchant reads lag behind casts and
// are sometimes missing, so this is a small state machine: a grace time after a cast, the time the
// buff was last seen to last until, and a "missing" reading that must hold before it is believed.
import { findWeaponBuffAura } from "./api/auras";
import { clearWeaponTooltipCache, getWeaponEnchant, hasWeaponTooltipText } from "./api/weapon";
import { hasKnownExpiry, NO_EXPIRY } from "./constants";
import { WEAPON_BUFF_BY_ENCHANT, type WeaponBuff } from "./data/weapon-buffs";
import { findSelectedWeaponBuff, findWeaponBuffForCast, isCoatingBothWeapons, getWeaponMatchTokens } from "./weapon-choice";

/** Weapon buffs warn this many seconds before they run out. */
const EXPIRY_WARNING = 30;
/** A "missing" reading must hold this long before it is believed. */
const MISSING_CONFIRM = 1.5;
/** After a cast, a missing reading is ignored this long (the enchant is still landing). */
const CAST_GRACE = 3;
/** An enchant change this soon after our own cast is that cast, not a drop. */
const CAST_ENCHANT_WINDOW = 8;

export interface WeaponCheck {
    spellId: number | undefined;
    /** Seconds left; 0 = missing. */
    remain: number;
    /** Remind now (missing, wrong, or about to run out). */
    isNeeded: boolean;
}

type HandState = "up" | "no" | "other" | "unknown";
type Hand = "main" | "off";

export class WeaponReminder {
    private graceUntil = 0;
    private castAt = 0;
    /** The buff counts as up until then (seen, or cast, plus its duration). */
    private seenUntil = 0;
    /** A WEAPON_ENCHANT_CHANGED we did not cause: believe the next drop at once. */
    private shouldRecheckDrop = false;
    /** The last check asked for the weapon buff. */
    private wasNeededLast = false;
    private missingSince: number | undefined;
    /** Two-weapon mode: per hand. */
    private readonly handMissingSince = new LuaMap<Hand, number>();

    /**
     * The player cast a spell: if it put on a weapon buff, its grace time starts. In combat the
     * client may hide both the spell ID and its name; a cast like that, while the weapon buff is
     * wanted, is assumed to be the weapon buff. A cast we can identify as another spell (the
     * shield) is not: it must not hide the weapon glow.
     */
    noteCast(spellId: number | undefined, castName: string | undefined): void {
        const isIdentified = (spellId !== undefined && !issecretvalue(spellId)) || castName !== undefined;
        const entry = findWeaponBuffForCast(spellId, castName) ?? (!isIdentified && this.wasNeededLast ? findSelectedWeaponBuff()?.entry : undefined);
        if (!entry) return;
        this.rememberApply(entry);
        clearWeaponTooltipCache();
    }

    noteEnchantChanged(): void {
        const pick = findSelectedWeaponBuff();
        if (!pick) return;
        if (this.wasNeededLast) return this.rememberApply(pick.entry);
        const now = GetTime();
        if (now < this.graceUntil || (this.castAt > 0 && now - this.castAt < CAST_ENCHANT_WINDOW)) return;
        this.shouldRecheckDrop = true;
    }

    /** A different weapon was equipped: what we remembered is about the old one. */
    clearMemory(): void {
        this.graceUntil = 0;
        this.seenUntil = 0;
        this.castAt = 0;
        this.shouldRecheckDrop = false;
    }

    /** The weapon buff to remind about, if the class has one learned. */
    check(): WeaponCheck | undefined {
        if (isCoatingBothWeapons()) return this.checkBothHands();
        const pick = findSelectedWeaponBuff();
        if (!pick) {
            this.wasNeededLast = false;
            return undefined;
        }
        const { entry, spellId } = pick;
        const { status, remain } = this.detect(entry);
        if (status !== "missing") this.missingSince = undefined;
        const now = GetTime();
        const buildResult = (left: number, isNeeded: boolean): WeaponCheck => {
            this.wasNeededLast = isNeeded;
            return { spellId, remain: left, isNeeded };
        };

        if (status === "up") {
            this.shouldRecheckDrop = false;
            this.seenUntil = now + (hasKnownExpiry(remain) ? remain : entry.duration);
            this.graceUntil = 0;
            return buildResult(remain, hasKnownExpiry(remain) && remain <= EXPIRY_WARNING);
        }
        if (this.shouldRecheckDrop) {
            this.shouldRecheckDrop = false;
            this.forgetSeen();
            return buildResult(0, true);
        }
        if (status === "missing") {
            // Past the grace after a cast, believe the client once the reading has held for a
            // moment, even if we "saw" the buff recently (removed by hand, or replaced)
            this.missingSince ??= now;
            if (now >= this.graceUntil && now - this.missingSince >= MISSING_CONFIRM) {
                this.forgetSeen();
                return buildResult(0, true);
            }
            if (now < this.graceUntil || now < this.seenUntil) {
                const left = math.max(this.seenUntil - now, 0);
                return buildResult(left, left > 0 && left <= EXPIRY_WARNING);
            }
            this.forgetSeen();
            return buildResult(0, true);
        }
        // Unknown: trust the grace time and what we saw last
        if (now < this.graceUntil) return buildResult(0, false);
        if (now < this.seenUntil) {
            const left = this.seenUntil - now;
            return buildResult(left, left <= EXPIRY_WARNING);
        }
        return buildResult(0, true);
    }

    private rememberApply(entry: WeaponBuff): void {
        const now = GetTime();
        this.graceUntil = now + CAST_GRACE;
        this.castAt = now;
        this.seenUntil = now + entry.duration;
        this.shouldRecheckDrop = false;
    }

    private forgetSeen(): void {
        this.seenUntil = 0;
        this.graceUntil = 0;
    }

    private getHandState(entry: WeaponBuff, isOffhand: boolean): { state: HandState; remain: number } {
        const read = getWeaponEnchant(isOffhand);
        if (read.has === true) {
            // An enchant ID we know that belongs to another buff: a different imbue
            const owner = read.enchantId !== undefined ? WEAPON_BUFF_BY_ENCHANT.get(read.enchantId) : undefined;
            if (owner && owner !== entry) return { state: "other", remain: 0 };
            return { state: "up", remain: read.remain };
        }
        return { state: read.has === false ? "no" : "unknown", remain: 0 };
    }

    /** Is the buff up on either weapon: as an aura, an enchant, or in the tooltip? */
    private detect(entry: WeaponBuff): { status: "up" | "missing" | "unknown"; remain: number } {
        const aura = findWeaponBuffAura(entry);
        if (aura.isFound) return { status: "up", remain: aura.remain };
        const main = this.getHandState(entry, false);
        const off = this.getHandState(entry, true);
        if (main.state === "up" || off.state === "up") return { status: "up", remain: main.state === "up" ? main.remain : off.remain };
        if (hasWeaponTooltipText(getWeaponMatchTokens(entry))) return { status: "up", remain: NO_EXPIRY };
        const isGone = (state: HandState) => state === "no" || state === "other";
        if ((main.state === "no" && isGone(off.state)) || (off.state === "no" && isGone(main.state))) return { status: "missing", remain: 0 };
        if ((main.state === "other" || off.state === "other") && main.state !== "unknown" && off.state !== "unknown") {
            return { status: "missing", remain: 0 };
        }
        return { status: "unknown", remain: 0 };
    }

    /** One hand of a two-weapon class: its spell when it needs a reminder. */
    private checkHand(isOffhand: boolean, now: number): { spellId: number; remain: number } | undefined {
        const hand: Hand = isOffhand ? "off" : "main";
        const pick = findSelectedWeaponBuff(isOffhand);
        if (!pick) {
            this.handMissingSince.delete(hand);
            return undefined;
        }
        let { state, remain } = this.getHandState(pick.entry, isOffhand);
        if (state !== "up") {
            // A poison kept as an aura covers both hands
            const aura = findWeaponBuffAura(pick.entry);
            if (aura.isFound) [state, remain] = ["up", aura.remain];
        }
        if (state === "up" || state === "unknown") {
            // Unknown: the client did not answer; stay quiet rather than nag
            this.handMissingSince.delete(hand);
            return state === "up" && hasKnownExpiry(remain) && remain <= EXPIRY_WARNING ? { spellId: pick.spellId, remain } : undefined;
        }
        // Missing or another poison: wait out the cast, and believe a reading that holds
        const since = this.handMissingSince.get(hand) ?? now;
        this.handMissingSince.set(hand, since);
        if (now < this.graceUntil || now - since < MISSING_CONFIRM) return undefined;
        return { spellId: pick.spellId, remain: 0 };
    }

    /** Two coated weapons (rogue): each hand on its own; the first one that needs a poison wins. */
    private checkBothHands(): WeaponCheck {
        const now = GetTime();
        const due = this.checkHand(false, now) ?? this.checkHand(true, now);
        this.wasNeededLast = due !== undefined;
        if (due) return { spellId: due.spellId, remain: due.remain, isNeeded: true };
        return { spellId: findSelectedWeaponBuff(false)?.spellId, remain: 0, isNeeded: false };
    }
}

export const weaponReminder = new WeaponReminder();
