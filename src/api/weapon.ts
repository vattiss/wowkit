// Weapon enchants (temporary enchants and imbues) and weapon tooltips.
import { MAIN_HAND_SLOT, NO_EXPIRY, OFF_HAND_SLOT } from "../constants";
import { isReadable, getReadable, tryCall } from "../util/safe";
import { contains } from "../util/text";

/** has: true/false, or undefined when the client gave no answer. remain: seconds, or NO_EXPIRY. */
export interface EnchantRead {
    has: boolean | undefined;
    remain: number;
    enchantId?: number;
}

function toNumber(value: unknown): number | undefined {
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
    const remainMs = toNumber(enchant.remainingTimeMs);
    const remain = remainMs !== undefined ? remainMs / 1000 : 0;
    return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: toNumber(enchant.enchantID) };
}

/** C_Item.GetWeaponEnchantInfo: only a temporary enchant or an imbue counts. */
function readItemEnchant(isOffhand: boolean): EnchantRead | undefined {
    const [didSucceed, list] = tryCall(C_Item.GetWeaponEnchantInfo, isOffhand ? Enum.WeaponSlot.OffHand : Enum.WeaponSlot.MainHand);
    if (!didSucceed || type(list) !== "table") return undefined;
    for (const entry of list as WeaponEnchantInfo[]) {
        const kind = getReadable(entry.enchantType);
        if ((kind === Enum.ItemEnchantType.Temporary || kind === Enum.ItemEnchantType.Imbue) && getReadable(entry.hasEnchant) === true) {
            let remain = toNumber(entry.timeLeft) ?? 0;
            // Some clients report milliseconds here
            if (remain > 10000) remain = remain / 1000;
            const enchantId = toNumber(entry.enchantID);
            return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: enchantId !== undefined && enchantId > 0 ? enchantId : undefined };
        }
    }
    return { has: false, remain: 0, enchantId: 0 };
}

/** The temporary enchant of a hand; `has` is undefined when neither API answers. */
export function getWeaponEnchant(isOffhand: boolean): EnchantRead {
    return readTemporaryEnchant(isOffhand) ?? readItemEnchant(isOffhand) ?? { has: undefined, remain: 0 };
}

let tooltipCacheAt = 0;
let tooltipCache: string[] | undefined;

/** The lowercase lines of both weapon tooltips (cached for a second). */
function getWeaponTooltipTexts(): string[] {
    const now = GetTime();
    if (tooltipCache && now - tooltipCacheAt < 1) return tooltipCache;
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
    tooltipCacheAt = now;
    tooltipCache = texts;
    return texts;
}

export function clearWeaponTooltipCache(): void {
    tooltipCacheAt = 0;
    tooltipCache = undefined;
}

/** Does a weapon tooltip mention any of the (lowercase) tokens? */
export function hasWeaponTooltipText(tokens: string[]): boolean {
    if (tokens.length === 0) return false;
    for (const text of getWeaponTooltipTexts()) {
        for (const token of tokens) {
            if (token !== "" && contains(text, token)) return true;
        }
    }
    return false;
}
