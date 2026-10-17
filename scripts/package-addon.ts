// Copies the static addon files (TOC, images, ...) from the addon's addon/ to its dist/<AddonName>/, filling in
// @version@ in the TOC.
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { getAddonDir, readAddonPackageJson } from "./lib/paths.ts";

const addonDir = getAddonDir();
const ADDON_DIR = `${addonDir}/addon`;
const pkg = readAddonPackageJson(addonDir);
const outDir = `${addonDir}/dist/${pkg.addon.name}`;
cpSync(ADDON_DIR, outDir, { recursive: true });

for (const file of readdirSync(ADDON_DIR).filter((f) => f.endsWith(".toc"))) {
    const content = readFileSync(`${ADDON_DIR}/${file}`, "utf8").replaceAll("@version@", pkg.version);
    writeFileSync(`${outDir}/${file}`, content);
}
console.log(`Packaged ${outDir}`);
