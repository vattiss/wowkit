// Weapon enchants (temporary enchants and imbues) and weapon tooltips.

import { contains } from "@forever/framework";
import { isReadable, getReadable, tryCall } from "./safe";
import { MAIN_HAND_SLOT, NO_EXPIRY, OFF_HAND_SLOT } from "./wow.constants";

/** has: true/false, or undefined when the client gave no answer. remain: seconds, or NO_EXPIRY. */
export interface EnchantRead {
    has: boolean | undefined;
    remain: number;
    enchantId?: number;
}

function convertToNumber(value: unknown): number | undefined {
    if (!isReadable(value)) return undefined;
    return tonumber(value);
}

/** C_PaperDollInfo, what the Blizzard buff frame uses. */
function readTemporaryEnchant(isOffhand: boolean): EnchantRead | undefined {
    const [didSucceed, info] = tryCall(C_PaperDollInfo.GetTemporaryEnchantmentInfo, isOffhand ? OFF_HAND_SLOT : MAIN_HAND_SLOT);
    if (!didSucceed) return undefined;
    if (info === undefined) return { has: false, remain: 0, enchantId: 0 };
    if (type(info) !== "table") return undefined;
    const enchant = info as TemporaryItemEnchantInfo;
    const remainMs = convertToNumber(enchant.remainingTimeMs);
    const remain = remainMs !== undefined ? remainMs / 1000 : 0;
    return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: convertToNumber(enchant.enchantID) };
}

function isTemporaryOrImbue(entry: WeaponEnchantInfo): boolean {
    const kind = getReadable(entry.enchantType);
    return (kind === Enum.ItemEnchantType.Temporary || kind === Enum.ItemEnchantType.Imbue) && getReadable(entry.hasEnchant) === true;
}

function describeItemEnchant(entry: WeaponEnchantInfo): EnchantRead {
    let remain = convertToNumber(entry.timeLeft) ?? 0;
    // Some clients report milliseconds here
    if (remain > 10000) remain = remain / 1000;
    const enchantId = convertToNumber(entry.enchantID);
    return {
        has: true,
        remain: remain > 0 ? remain : NO_EXPIRY,
        enchantId: enchantId !== undefined && enchantId > 0 ? enchantId : undefined,
    };
}

/** C_Item.GetWeaponEnchantInfo: only a temporary enchant or an imbue counts. */
function readItemEnchant(isOffhand: boolean): EnchantRead | undefined {
    const [didSucceed, list] = tryCall(C_Item.GetWeaponEnchantInfo, isOffhand ? Enum.WeaponSlot.OffHand : Enum.WeaponSlot.MainHand);
    if (!didSucceed || type(list) !== "table") return undefined;
    for (const entry of list as WeaponEnchantInfo[]) {
        if (isTemporaryOrImbue(entry)) return describeItemEnchant(entry);
    }
    return { has: false, remain: 0, enchantId: 0 };
}

export class WeaponEnchantsService {
    private tooltipCacheAt = 0;
    private tooltipCache: string[] | undefined;

    /** The temporary enchant of a hand; `has` is undefined when neither API answers. */
    getWeaponEnchant(isOffhand: boolean): EnchantRead {
        return readTemporaryEnchant(isOffhand) ?? readItemEnchant(isOffhand) ?? { has: undefined, remain: 0 };
    }

    clearWeaponTooltipCache(): void {
        this.tooltipCacheAt = 0;
        this.tooltipCache = undefined;
    }

    /** Does a weapon tooltip mention any of the (lowercase) tokens? */
    hasWeaponTooltipText(tokens: string[]): boolean {
        if (tokens.length === 0) return false;
        for (const text of this.getWeaponTooltipTexts()) {
            for (const token of tokens) {
                if (token !== "" && contains(text, token)) return true;
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
}
