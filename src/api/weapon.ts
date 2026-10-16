// Weapon enchants (temporary enchants and imbues) and weapon tooltips.
import { MAIN_HAND_SLOT, NO_EXPIRY, OFF_HAND_SLOT } from "../constants";
import { readable, safe, tryCall } from "../util/safe";
import { contains } from "../util/text";

/** has: true/false, or undefined when the client gave no answer. remain: seconds, or NO_EXPIRY. */
export interface EnchantRead {
    has: boolean | undefined;
    remain: number;
    enchantId?: number;
}

function asNumber(value: unknown): number | undefined {
    if (!readable(value)) return undefined;
    return tonumber(value);
}

/** C_PaperDollInfo, what the Blizzard buff frame uses. */
function readTemporaryEnchant(offhand: boolean): EnchantRead | undefined {
    const [ok, info] = tryCall(C_PaperDollInfo.GetTemporaryEnchantmentInfo, offhand ? OFF_HAND_SLOT : MAIN_HAND_SLOT);
    if (!ok) return undefined;
    if (info === undefined) return { has: false, remain: 0, enchantId: 0 };
    if (type(info) !== "table") return undefined;
    const enchant = info as TemporaryItemEnchantInfo;
    const remainMs = asNumber(enchant.remainingTimeMs);
    const remain = remainMs !== undefined ? remainMs / 1000 : 0;
    return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: asNumber(enchant.enchantID) };
}

/** C_Item.GetWeaponEnchantInfo: only a temporary enchant or an imbue counts. */
function readItemEnchant(offhand: boolean): EnchantRead | undefined {
    const [ok, list] = tryCall(C_Item.GetWeaponEnchantInfo, offhand ? Enum.WeaponSlot.OffHand : Enum.WeaponSlot.MainHand);
    if (!ok || type(list) !== "table") return undefined;
    for (const entry of list as WeaponEnchantInfo[]) {
        const kind = safe(entry.enchantType);
        if ((kind === Enum.ItemEnchantType.Temporary || kind === Enum.ItemEnchantType.Imbue) && safe(entry.hasEnchant) === true) {
            let remain = asNumber(entry.timeLeft) ?? 0;
            // Some clients report milliseconds here
            if (remain > 10000) remain = remain / 1000;
            const enchantId = asNumber(entry.enchantID);
            return { has: true, remain: remain > 0 ? remain : NO_EXPIRY, enchantId: enchantId !== undefined && enchantId > 0 ? enchantId : undefined };
        }
    }
    return { has: false, remain: 0, enchantId: 0 };
}

/** The temporary enchant of a hand; `has` is undefined when neither API answers. */
export function weaponEnchant(offhand: boolean): EnchantRead {
    return readTemporaryEnchant(offhand) ?? readItemEnchant(offhand) ?? { has: undefined, remain: 0 };
}

let tooltipCacheAt = 0;
let tooltipCache: string[] | undefined;

/** The lowercase lines of both weapon tooltips (cached for a second). */
function weaponTooltipTexts(): string[] {
    const now = GetTime();
    if (tooltipCache && now - tooltipCacheAt < 1) return tooltipCache;
    const texts: string[] = [];
    for (const slot of [MAIN_HAND_SLOT, OFF_HAND_SLOT]) {
        const [ok, data] = tryCall(C_TooltipInfo.GetInventoryItem, "player", slot);
        if (ok && data !== undefined && type(data) === "table" && data.lines) {
            for (const line of data.lines) {
                const text = safe(line.leftText);
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
export function weaponTooltipHas(tokens: string[]): boolean {
    if (tokens.length === 0) return false;
    for (const text of weaponTooltipTexts()) {
        for (const token of tokens) {
            if (token !== "" && contains(text, token)) return true;
        }
    }
    return false;
}
