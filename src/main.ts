// Addon entry point and composition root: wires the modules together.
// WoW runs each addon file with `...` = (addonName, addonTable).
import { setBuffDurationLookup } from "./api/auras";
import { buffSeconds } from "./buffs";
import { booted, start } from "./core";
import * as debug from "./debug";
import { say } from "./locale";
import { registerOptions } from "./options";

const [addonName = "ForeverReminders"] = [...$vararg];

// The aura memory learns buff durations from the class buff lists
setBuffDurationLookup(buffSeconds);
debug.init(addonName);
booted.listen(() => {
    const [ok, err] = pcall(registerOptions);
    if (!ok) say(tostring(err));
    debug.apply();
});
start(addonName);
