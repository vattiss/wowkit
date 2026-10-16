// Addon entry point and composition root: wires the modules together.
// WoW runs each addon file with `...` = (addonName, addonTable).
import { setBuffDurationLookup } from "./wow/auras";
import { getBuffSeconds } from "./reminders/class-buffs";
import { booted, startGameEvents } from "./core/game-events";
import { applyDebugMode, initDebug } from "./ui/diagnostics/debug-mode";
import { registerOptions } from "./ui/options/register-options";

const [addonName = "ForeverReminders"] = [...$vararg];

// The aura memory learns buff durations from the class buff lists
setBuffDurationLookup(getBuffSeconds);
initDebug(addonName);
booted.listen(() => {
    registerOptions();
    applyDebugMode();
});
startGameEvents(addonName);
