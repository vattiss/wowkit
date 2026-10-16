// Copies the static addon files (TOC, images, ...) from addon/ to dist/<AddonName>/, filling in
// @version@ in the TOC.
import { cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { ADDON_DIR, DIST_DIR, readPackageJson } from "./lib/paths.ts";

const pkg = readPackageJson();
const outDir = `${DIST_DIR}/${pkg.addon.name}`;
cpSync(ADDON_DIR, outDir, { recursive: true });

for (const file of readdirSync(ADDON_DIR).filter((f) => f.endsWith(".toc"))) {
    const content = readFileSync(`${ADDON_DIR}/${file}`, "utf8").replaceAll("@version@", pkg.version);
    writeFileSync(`${outDir}/${file}`, content);
}
console.log(`Packaged ${outDir}`);
