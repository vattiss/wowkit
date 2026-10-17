// Runs the Lua tests of a package (dist-test/tests.lua in the folder it is started in, built by "pnpm build:tests")
// with a Lua 5.1 interpreter (LuaJIT by default). Set LUA to use another one.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const lua = process.env.LUA ?? "luajit";
const testsFile = `${process.cwd()}/dist-test/tests.lua`;
if (!existsSync(testsFile)) {
    console.error(`Missing ${testsFile}. Run "pnpm build:tests" first (pnpm test does).`);
    process.exit(1);
}

const result = spawnSync(lua, [testsFile], { stdio: "inherit" });
if (result.error) {
    console.error(`Could not run "${lua}": ${result.error.message}. Install LuaJIT or set LUA.`);
    process.exit(1);
}
process.exit(result.status ?? 1);
