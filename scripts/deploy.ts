// Copies dist/<AddonName>/ into the game's AddOns folder.
// Set WOW_ADDONS_DIR, e.g. "C:\Program Files (x86)\World of Warcraft\_forever_\Interface\AddOns".
import { cpSync, existsSync, rmSync } from "node:fs";
import { DIST_DIR, readPackageJson } from "./lib/paths.ts";

const addonsDir = process.env.WOW_ADDONS_DIR;
if (!addonsDir || !existsSync(addonsDir)) {
    console.error(`Set WOW_ADDONS_DIR to the game's Interface\\AddOns folder (currently: ${addonsDir ?? "unset"}).`);
    process.exit(1);
}

const { name } = readPackageJson().addon;
const target = `${addonsDir}/${name}`;
rmSync(target, { recursive: true, force: true });
cpSync(`${DIST_DIR}/${name}`, target, { recursive: true });
console.log(`Deployed to ${target}. Type /reload in game to load the new build.`);
