// Fetches the API documentation folders of Gethe/wow-ui-source at the commit pinned in package.json.
//   node scripts/fetch-wow-ui-source.ts            -> check out the pinned commit
//   node scripts/fetch-wow-ui-source.ts --latest   -> move the pin to the tip of the branch
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CACHE_DIR, PACKAGE_JSON, readPackageJson } from "./lib/paths.ts";

const SPARSE_PATHS = [
    "/version.txt",
    "/Interface/AddOns/Blizzard_APIDocumentation/",
    "/Interface/AddOns/Blizzard_APIDocumentationGenerated/",
];

function git(...args: string[]): string {
    return execFileSync("git", args, { cwd: existsSync(CACHE_DIR) ? CACHE_DIR : undefined, encoding: "utf8" }).trim();
}

const pkg = readPackageJson();
const source = pkg.wowUiSource;

if (!existsSync(CACHE_DIR)) {
    execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "--branch", source.branch, source.repository, CACHE_DIR], {
        stdio: "inherit",
    });
    git("sparse-checkout", "set", "--no-cone", ...SPARSE_PATHS);
}

let commit = source.commit;
if (process.argv.includes("--latest")) {
    git("fetch", "origin", source.branch);
    commit = git("rev-parse", `origin/${source.branch}`);
} else if (!git("cat-file", "-t", commit).startsWith("commit")) {
    git("fetch", "origin", commit);
}

git("-c", "advice.detachedHead=false", "checkout", "--quiet", commit);
const version = readFileSync(`${CACHE_DIR}/version.txt`, "utf8").trim();
console.log(`wow-ui-source ${source.branch} @ ${commit.slice(0, 10)} (game version ${version})`);

if (commit !== source.commit) {
    // Rewrite only the pinned commit so the rest of package.json keeps its formatting
    const text = readFileSync(PACKAGE_JSON, "utf8").replace(source.commit, commit);
    writeFileSync(PACKAGE_JSON, text);
    console.log(`Pinned commit updated in package.json; run "npm run gen:types" to regenerate the declarations.`);
}
