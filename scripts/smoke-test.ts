// Runs the tests (test/, TypeScript compiled to dist-test/tests.lua by "npm run build:tests") with a
// Lua 5.1 interpreter (LuaJIT by default) against the built addon. Set LUA to use another one.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { DIST_DIR, ROOT, readPackageJson } from "./lib/paths.ts";

const SPECS_DIR = `${ROOT}test/specs`;
const lua = process.env.LUA ?? "luajit";
const { name } = readPackageJson().addon;
const addonFile = `${DIST_DIR}/${name}/${name}.lua`;
const testsFile = `${ROOT}dist-test/tests.lua`;

// A spec nobody imports would never run, and nobody would notice
const index = readFileSync(`${SPECS_DIR}/index.ts`, "utf8");
const forgotten = readdirSync(SPECS_DIR).filter((file) => file.endsWith(".spec.ts") && !index.includes(`./${file.replace(".ts", "")}"`));
if (forgotten.length > 0) {
    console.error(`These specs are not imported in test/specs/index.ts, so they would not run: ${forgotten.join(", ")}`);
    process.exit(1);
}
for (const file of [addonFile, testsFile]) {
    if (!existsSync(file)) {
        console.error(`Missing ${file}. Run "npm run build" and "npm run build:tests" first (npm test does).`);
        process.exit(1);
    }
}

const result = spawnSync(lua, [testsFile, addonFile], { stdio: "inherit" });
if (result.error) {
    console.error(`Could not run "${lua}": ${result.error.message}. Install LuaJIT or set LUA.`);
    process.exit(1);
}
process.exit(result.status ?? 1);
