// Weapon enchants (temporary enchants and imbues) and weapon tooltips.

import { tryCall } from "./utils/protected-call.utils";
import { isReadable, getReadable } from "./utils/secret-value.utils";
import { MAIN_HAND_SLOT, NO_EXPIRY, OFF_HAND_SLOT } from "./wow.constants";
import { doesTextName } from "./utils/spell-name.utils";

/**
 * The two places of a weapon's enchants on Forever, held at once: an imbue (a class's: a rogue's poisons, a shaman's weapon
 * imbues, a warlock's Firestone and Spellstone) and a temporary enchant (sharpening stones, weightstones, oils).
 */
export type EnchantPlace = "imbue" | "temporary";

/** has: true/false, or undefined when the client gave no answer. remain: seconds, or NO_EXPIRY. */
export interface EnchantRead {
    has: boolean | undefined;
    remain: number;
    enchantId?: number;
}

export class WeaponEnchantsService {
    private tooltipCacheAt = 0;
    private tooltipCache: string[] | undefined;

    /**
     * The enchant of one place of a hand; `has` is undefined when the client gives no answer. A client without the list of
     * the hand's enchants gives the one its buff frame shows (the imbue first) for either place.
     */
    getWeaponEnchant(isOffhand: boolean, place: EnchantPlace): EnchantRead {
        return this.readItemEnchant(isOffhand, place) ?? this.readTemporaryEnchant(isOffhand) ?? { has: undefined, remain: 0 };
    }

    clearWeaponTooltipCache(): void {
        this.tooltipCacheAt = 0;
        this.tooltipCache = undefined;
    }

    /** Does a weapon tooltip mention any of the tokens, however either writes it (see doesTextName)? */
    hasWeaponTooltipText(tokens: string[]): boolean {
        if (tokens.length === 0) return false;
        for (const text of this.getWeaponTooltipTexts()) {
            for (const token of tokens) {
                if (doesTextName(text, token)) return true;
            }
        }
        return false;
    }

    /** The lowercase lines of both weapon tooltips (cached for a second). */
    private getWeaponTooltipTexts(): string[] {
        const now = GetTime();
        if (this.tooltipCache && now - this.tooltipCacheAt < 1) return this.tooltipCache;
        const texts: string[] = [];
        for (const slot of [MAIN_HAND_SLOT, OFF_HAND_SLOT]) {
            const [didSucceed, data] = tryCall(C_TooltipInfo.GetInventoryItem, "player", slot);
            if (didSucceed && data !== undefined && type(data) === "table" && data.lines) {
                for (const line of data.lines) {
                    const text = getReadable(line.leftText);
                    if (text !== undefined) texts.push(string.lower(text));
                }
            }
        }
        this.tooltipCacheAt = now;
        this.tooltipCache = texts;
        return texts;
    }

    private convertToNumber(value: unknown): number | undefined {
        if (!isReadable(value)) return undefined;
        return tonumber(value);
    }

    /** C_PaperDollInfo: one enchant of the hand (on Forever the imbue, else the temporary one), for a client without the list. */
    private readTemporaryEnchant(isOffhand: boolean): EnchantRead | undefined {
        const [didSucceed, info] = tryCall(C_PaperDollInfo.GetTemporaryEnchantmentInfo, isOffhand ? OFF_HAND_SLOT : MAIN_HAND_SLOT);
        if (!didSucceed) return undefined;
        if (info === undefined) return { has: false, remain: 0, enchantId: 0 };
        if (type(info) !== "table") return undefined;
        const enchant = info as TemporaryItemEnchantInfo;
        const remainMs = this.convertToNumber(enchant.remainingTimeMs);
        const remain = remainMs !== undefined ? remainMs / 1000 : 0;
        return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: this.convertToNumber(enchant.enchantID) };
    }

    /**
     * C_Item.GetWeaponEnchantInfo, what the Blizzard buff frame lists: every enchant of the hand with its kind, the one of this
     * place. Undefined when the call fails (the other call answers then); no answer (has undefined) while the list or a value
     * of it is secret.
     */
    private readItemEnchant(isOffhand: boolean, place: EnchantPlace): EnchantRead | undefined {
        const [didSucceed, list] = tryCall(C_Item.GetWeaponEnchantInfo, isOffhand ? Enum.WeaponSlot.OffHand : Enum.WeaponSlot.MainHand);
        if (!didSucceed) return undefined;
        // Kept secret (in a fight): no answer, never a guess by the other call
        if (!isReadable(list) || type(list) !== "table") return { has: undefined, remain: 0 };
        const wanted = place === "imbue" ? Enum.ItemEnchantType.Imbue : Enum.ItemEnchantType.Temporary;
        for (const entry of list as WeaponEnchantInfo[]) {
            const kind = getReadable(entry.enchantType);
            const has = getReadable(entry.hasEnchant);
            if (kind === undefined || has === undefined) return { has: undefined, remain: 0 };
            if (kind === wanted && has) return this.describeItemEnchant(entry);
        }
        return { has: false, remain: 0, enchantId: 0 };
    }

    /** Its time left is in milliseconds, always (the buff frame divides it so). */
    private describeItemEnchant(entry: WeaponEnchantInfo): EnchantRead {
        const remainMs = this.convertToNumber(entry.timeLeft) ?? 0;
        const enchantId = this.convertToNumber(entry.enchantID);
        return {
            has: true,
            remain: remainMs > 0 ? remainMs / 1000 : NO_EXPIRY,
            enchantId: enchantId !== undefined && enchantId > 0 ? enchantId : undefined,
        };
    }
}
