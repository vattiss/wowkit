// Addon entry point: puts the addon together and starts it.
import { startAddon } from "./addon";

// The game gives every file of an addon the addon's folder name as its first argument; `[...$vararg]` reads it.
const [addonName] = [...$vararg];

startAddon(addonName!);
