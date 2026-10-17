// Addon entry point: puts the addon together and starts it.
// WoW runs each addon file with `...` = (addonName, addonTable).
import { startAddon } from "./addon";

const [addonName = "ForeverReminders"] = [...$vararg];

startAddon(addonName);
