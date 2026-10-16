// Addon entry point and composition root: wires the modules together.
// WoW runs each addon file with `...` = (addonName, addonTable).
import { setBuffDurationLookup } from "./wow/auras";
import { getBuffSeconds } from "./reminders/class-buffs";
import { booted, startGameEvents } from "./core/game-events";
import { initDebug, applyDebugMode } from "./ui/diagnostics";
import { registerOptions } from "./ui/options-page";

const [addonName = "ForeverReminders"] = [...$vararg];

// The aura memory learns buff durations from the class buff lists
setBuffDurationLookup(getBuffSeconds);
initDebug(addonName);
booted.listen(() => {
    registerOptions();
    applyDebugMode();
});
startGameEvents(addonName);
