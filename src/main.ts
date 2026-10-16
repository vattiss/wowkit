// Addon entry point and composition root: wires the modules together.
// WoW runs each addon file with `...` = (addonName, addonTable).
import { setBuffDurationLookup } from "./api/auras";
import { getBuffSeconds } from "./buffs";
import { booted, start } from "./core";
import * as debug from "./debug";
import { say } from "./locale";
import { registerOptions } from "./options";

const [addonName = "ForeverReminders"] = [...$vararg];

// The aura memory learns buff durations from the class buff lists
setBuffDurationLookup(getBuffSeconds);
debug.initDebug(addonName);
booted.listen(() => {
    const [didSucceed, err] = pcall(registerOptions);
    if (!didSucceed) say(tostring(err));
    debug.applyDebugMode();
});
start(addonName);
