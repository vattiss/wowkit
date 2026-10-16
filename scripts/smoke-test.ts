// Runs test/smoke_test.lua against the built addon with a Lua 5.1 interpreter (LuaJIT by default).
// Set LUA to use another interpreter, e.g. LUA=lua5.1.
import { spawnSync } from "node:child_process";
import { DIST_DIR, ROOT, readPackageJson } from "./lib/paths.ts";

const lua = process.env.LUA ?? "luajit";
const { name } = readPackageJson().addon;
const result = spawnSync(lua, [`${ROOT}test/smoke_test.lua`, `${DIST_DIR}/${name}/${name}.lua`], { stdio: "inherit" });
if (result.error) {
    console.error(`Could not run "${lua}": ${result.error.message}. Install LuaJIT or set LUA.`);
    process.exit(1);
}
process.exit(result.status ?? 1);
