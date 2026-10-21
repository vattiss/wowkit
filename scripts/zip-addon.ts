// Packs the addon's dist/<AddonName>/ into dist/<AddonName>-<version>.zip, the file to upload by hand to CurseForge, and
// writes dist/changelog.md: the hand-written release notes of the version (release-notes/<version>.md) when there are
// some, else the subjects of the commits since the addon's previous tag that touched the addon or the shared packages.
// Run from an addon folder after the build: pnpm --filter ./addons/<addon> zip
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, getAddonDir, readAddonPackageJson } from "./lib/paths.ts";

/** The text of `git`, or "" when it has nothing to say (no earlier tag, not a repository). */
function readGit(...args: string[]): string {
    try {
        return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return "";
    }
}

function buildChangelog(folder: string): string {
    const previousTag = readGit("describe", "--tags", "--abbrev=0", "--match", `${folder}-v*`, "HEAD~1");
    const range = previousTag === "" ? ["HEAD", "--max-count=30"] : [`${previousTag}..HEAD`];
    const subjects = readGit("log", ...range, "--pretty=format:- %s", "--", `addons/${folder}`, "packages");
    return subjects === "" ? "No changes recorded." : subjects;
}

/** The release notes written for the version, for players; undefined when there are none. */
function readReleaseNotes(addonDir: string, version: string): string | undefined {
    const path = `${addonDir}/release-notes/${version}.md`;
    return existsSync(path) ? readFileSync(path, "utf8").replaceAll("\r\n", "\n").trim() : undefined;
}

function createZip(distDir: string, name: string, zipPath: string): void {
    rmSync(zipPath, { force: true });
    // Windows ships a tar that writes zip files (not the GNU tar of Git Bash); Linux has zip
    if (process.platform === "win32") {
        const windowsTar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
        execFileSync(windowsTar, ["-a", "-c", "-f", zipPath, name], { cwd: distDir });
    } else {
        execFileSync("zip", ["-r", "-q", zipPath, name], { cwd: distDir });
    }
}

const addonDir = getAddonDir();
const { version, addon } = readAddonPackageJson(addonDir);
const distDir = `${addonDir}/dist`;
if (!existsSync(`${distDir}/${addon.name}`)) {
    console.error(`Build the addon first (pnpm --filter ./addons/<addon> build). Missing ${distDir}/${addon.name}`);
    process.exit(1);
}

const zipPath = `${distDir}/${addon.name}-${version}.zip`;
const changelog = readReleaseNotes(addonDir, version) ?? buildChangelog(addonDir.split("/").pop()!);
createZip(distDir, addon.name, zipPath);
writeFileSync(`${distDir}/changelog.md`, `${changelog}\n`);
console.log(`Zip: ${zipPath}\nChangelog (${distDir}/changelog.md):\n${changelog}`);
