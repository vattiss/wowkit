// The switches of the old rank reminders, kept by the spell's name. A client may write one name two ways (Plaie d'agonie and
// Plaie d’agonie), so a switch counts for every way of writing it (see isSameName), and is changed for all of them at once.
import { isSameName } from "@wowkit/wow";

interface RankSwitches {
    [name: string]: boolean | undefined;
}

/** Is the old rank reminder of this spell switched off, by its name however it is written? */
export function isRankSwitchedOff(switches: RankSwitches, name: string): boolean {
    if (switches[name] === false) return true;
    for (const [saved, isOn] of pairs(switches)) if (isOn === false && isSameName(saved as string, name)) return true;
    return false;
}

/** The switches with this spell's on or off: every way of writing its name dropped, then this one kept where it is off. */
export function changeRankSwitch(switches: RankSwitches, name: string, isEnabled: boolean): RankSwitches {
    const changed: RankSwitches = {};
    for (const [saved, isOn] of pairs(switches)) if (!isSameName(saved as string, name)) changed[saved as string] = isOn;
    if (!isEnabled) changed[name] = false;
    return changed;
}
