// What the game says about the weapon buff right now: on a hand, as an aura, or in a tooltip.

import type { AurasService } from "@forever/wow";
import { type AuraRead } from "@forever/wow";
import type { WeaponEnchantsService } from "@forever/wow";
import { NO_EXPIRY } from "@forever/wow";
import type { WeaponBuff } from "./weapon-buff.interface";
import { WEAPON_BUFF_BY_ENCHANT } from "./weapon-buffs.constants";
import type { WeaponChoiceService } from "./weapon-choice.service";

/** "other": an enchant that belongs to another buff (a different poison or imbue). */
export type HandState = "up" | "no" | "other" | "unknown";

export interface HandReading {
    state: HandState;
    remain: number;
}

export type BuffStatus = "up" | "missing" | "unknown";

export interface BuffReading {
    status: BuffStatus;
    /** Seconds left; NO_EXPIRY when the client does not say; 0 when not up. */
    remain: number;
}

function isGone(state: HandState): boolean {
    return state === "no" || state === "other";
}

export class WeaponReadingService {
    constructor(
        private readonly auras: AurasService,
        private readonly enchants: WeaponEnchantsService,
        private readonly choice: WeaponChoiceService,
    ) {}

    /** What is on one weapon, as far as the client says. */
    readHand(entry: WeaponBuff, isOffhand: boolean): HandReading {
        const read = this.enchants.getWeaponEnchant(isOffhand);
        if (read.has === true) {
            const owner = read.enchantId !== undefined ? WEAPON_BUFF_BY_ENCHANT.get(read.enchantId) : undefined;
            if (owner && owner !== entry) return { state: "other", remain: 0 };
            return { state: "up", remain: read.remain };
        }
        return { state: read.has === false ? "no" : "unknown", remain: 0 };
    }

    /** One weapon; a buff kept as an aura (a poison) covers both hands. */
    readHandOrAura(entry: WeaponBuff, isOffhand: boolean): HandReading {
        const hand = this.readHand(entry, isOffhand);
        if (hand.state === "up") return hand;
        const aura = this.findWeaponBuffAura(entry);
        return aura.isFound ? { state: "up", remain: aura.remain } : hand;
    }

    /** Is the buff up on either weapon: as an aura, an enchant, or in the tooltip? */
    readWeaponBuff(entry: WeaponBuff): BuffReading {
        const aura = this.findWeaponBuffAura(entry);
        if (aura.isFound) return { status: "up", remain: aura.remain };
        const main = this.readHand(entry, false);
        const off = this.readHand(entry, true);
        if (main.state === "up") return { status: "up", remain: main.remain };
        if (off.state === "up") return { status: "up", remain: off.remain };
        if (this.enchants.hasWeaponTooltipText(this.choice.getWeaponMatchTokens(entry))) return { status: "up", remain: NO_EXPIRY };
        // Missing needs an answer for both hands; one that did not answer leaves it unknown
        return { status: isGone(main.state) && isGone(off.state) ? "missing" : "unknown", remain: 0 };
    }

    /** A weapon buff kept as an aura on the player (some clients show imbues that way). */
    private findWeaponBuffAura(entry: WeaponBuff): AuraRead {
        for (const id of [entry.id, ...(entry.ranks ?? [])]) {
            const read = this.auras.findAura(id);
            if (read.isFound) return read;
        }
        return { isFound: false, remain: 0, isUnreadable: false };
    }
}
