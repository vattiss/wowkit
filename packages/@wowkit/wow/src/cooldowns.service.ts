// Spell cooldowns as the client tells them. In combat the client often hides them (secret values); the answer says so.
// A trinket's use spell has no cooldown of its own: the item has it, so the item's is read.
import { OnGameEvent } from "@wowkit/core";
import { findItemUseSpell } from "./utils/item-button.utils";
import { attempt, attemptMulti } from "./utils/protected-call.utils";
import { getReadable, getReadableId, isReadable } from "./utils/secret-value.utils";

/** A cooldown read: seconds left and its full length; `isHidden` when the client did not tell. */
export interface CooldownRead {
    remain: number;
    duration: number;
    isHidden: boolean;
}

/** A cooldown this short is the global cooldown, not the spell's own. */
const GLOBAL_COOLDOWN = 1.51;
/** What the client did not tell. */
const HIDDEN: CooldownRead = { remain: 0, duration: 0, isHidden: true };
/** The equipment slots, head to tabard. */
const LAST_EQUIPPED_SLOT = 19;
/** The action slots of every bar. */
const LAST_ACTION_SLOT = 120;

export class CooldownsService {
    /** Spell ID -> the item whose use it is (false: none), kept until the equipment or the bars change. */
    private readonly useItems = new LuaMap<number, number | false>();

    @OnGameEvent("PLAYER_EQUIPMENT_CHANGED", "ACTIONBAR_SLOT_CHANGED")
    forgetUseItems(): void {
        for (const [spellId] of this.useItems) this.useItems.delete(spellId);
    }

    /** The item, equipped or on the bars, whose use is this spell, when the spell has no cooldown of its own (a trinket's). */
    findUseItem(spellId: number): number | undefined {
        const kept = this.useItems.get(spellId);
        if (kept !== undefined) return kept === false ? undefined : kept;
        const found = this.getBaseCooldown(spellId) <= 0 ? this.lookUpUseItem(spellId) : undefined;
        this.useItems.set(spellId, found ?? false);
        return found;
    }

    private lookUpUseItem(spellId: number): number | undefined {
        for (let slot = 1; slot <= LAST_EQUIPPED_SLOT; slot++) {
            const itemId = getReadableId(attempt(GetInventoryItemID, "player", slot));
            if (itemId !== undefined && findItemUseSpell(itemId) === spellId) return itemId;
        }
        for (let slot = 1; slot <= LAST_ACTION_SLOT; slot++) {
            const [didRead, kind, id] = attemptMulti(() => GetActionInfo(slot));
            const itemId = didRead && getReadable(kind) === "item" ? getReadableId(id) : undefined;
            if (itemId !== undefined && findItemUseSpell(itemId) === spellId) return itemId;
        }
        return undefined;
    }

    /** The spell's cooldown now; the global cooldown alone counts as none. */
    readCooldown(spellId: number): CooldownRead {
        const itemId = this.findUseItem(spellId);
        if (itemId !== undefined) {
            const [didRead, itemStart, itemDuration] = attemptMulti(() => C_Container.GetItemCooldown(itemId));
            return didRead ? this.buildRead(itemStart, itemDuration) : HIDDEN;
        }
        const info = attempt(C_Spell.GetSpellCooldown, spellId);
        return info !== undefined && type(info) === "table" ? this.buildRead(info.startTime, info.duration) : HIDDEN;
    }

    private buildRead(start: unknown, duration: unknown): CooldownRead {
        if ((start !== undefined && !isReadable(start)) || (duration !== undefined && !isReadable(duration))) return HIDDEN;
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
