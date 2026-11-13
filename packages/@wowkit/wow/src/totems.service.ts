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

export class TotemsService {
    /** The totem in a slot; false when the slot is empty, undefined when the client hides it. */
    readTotemSlot(slot: number): StandingTotem | false | undefined {
        const [didSucceed, hasTotem, name, startTime, duration] = attemptMulti(() => GetTotemInfo(slot));
        if (!didSucceed || !isReadable(hasTotem)) return undefined;
        if (!hasTotem) return false;
        if (!isReadable(name) || !isReadable(startTime) || !isReadable(duration) || type(name) !== "string" || name === "")
            return undefined;
        return { name: name!, startTime: tonumber(startTime) ?? 0, duration: tonumber(duration) ?? 0 };
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
