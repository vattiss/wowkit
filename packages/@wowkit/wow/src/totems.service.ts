// The shaman's totems: what stands in each of the four totem slots, and which totems the player put into the totem bar.
// The client hides the slots in combat (secret values); the answer says so.
import { attempt, attemptMulti } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";

/** A totem standing in a slot: its name, when it was dropped (game clock) and how long it lasts. */
export interface StandingTotem {
    name: string;
    startTime: number;
    duration: number;
}

/** The totem slots: fire 1, earth 2, water 3, air 4. */
export const TOTEM_SLOTS = 4;

/** A slot that had a totem, and answers that it has one still, with no name or no duration: it is empty. */
function isEmptied(name: unknown, duration: unknown): boolean {
    return (isReadable(name) && name === "") || (isReadable(duration) && tonumber(duration) === 0);
}

export class TotemsService {
    /**
     * The totem in a slot; false when the slot is empty, undefined when the client hides it. A slot that had a totem keeps
     * answering that it has one, with no name and no duration: that is an empty slot too.
     */
    readTotemSlot(slot: number): StandingTotem | false | undefined {
        const [didSucceed, hasTotem, name, startTime, duration] = attemptMulti(() => GetTotemInfo(slot));
        if (!didSucceed || !isReadable(hasTotem)) return undefined;
        if (!hasTotem) return false;
        if (isEmptied(name, duration)) return false;
        if (!isReadable(name) || !isReadable(startTime) || !isReadable(duration) || type(name) !== "string" || name === "")
            return undefined;
        return { name: name!, startTime: tonumber(startTime) ?? 0, duration: tonumber(duration) ?? 0 };
    }

    /**
     * The slots a totem stands in, by Blizzard's totem frame: its code sees the slots the client hides from addons in a fight,
     * and shows a button for each totem standing, with its slot. A slot that had a totem keeps a hidden button: only the shown
     * ones count. Undefined without that frame (an addon may take it away), or when a button's showing cannot be read.
     */
    listFrameSlots(): LuaSet<number> | undefined {
        const frame = (_G as unknown as { TotemFrame?: TotemFrameWidget }).TotemFrame;
        const pool = frame?.totemPool;
        if (pool === undefined) return undefined;
        const slots = new LuaSet<number>();
        const isRead = attempt(() => {
            for (const [button] of pool.EnumerateActive()) {
                const slot = getReadable(button.slot);
                const isShown = getReadable(button.IsShown());
                if (isShown === undefined) return false;
                if (isShown && slot !== undefined && type(slot) === "number") slots.add(slot);
            }
            return true;
        });
        return isRead === true ? slots : undefined;
    }

    /** The totem spells the player knows for a slot, as the totem bar offers them; none when the client gives no answer. */
    listSlotSpells(slot: number): number[] {
        const ids = attempt(() => [...GetMultiCastTotemSpells(slot)]) ?? [];
        const spells: number[] = [];
        for (const id of ids) {
            const readable = getReadable(id);
            if (readable !== undefined && type(readable) === "number") spells.push(readable);
        }
        return spells;
    }

    /** The spells the player put into the totem bar (MultiCastActionButton1-4, readable in combat), in slot order. */
    listTotemBarSpells(): number[] {
        const spells: number[] = [];
        for (let i = 1; i <= TOTEM_SLOTS; i++) {
            const button = (_G as unknown as { [name: string]: ActionButton | undefined })[`MultiCastActionButton${i}`];
            const slot = button ? (button.action ?? tonumber(attempt(() => button.GetAttribute("action")))) : undefined;
            if (slot !== undefined) {
                const [didSucceed, kind, id] = attemptMulti(() => GetActionInfo(slot));
                if (didSucceed && isReadable(kind) && kind === "spell" && getReadable(id) !== undefined) spells.push(id!);
            }
        }
        return spells;
    }
}
