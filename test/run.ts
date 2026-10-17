// Entry of the test bundle: luajit dist-test/tests.lua dist/ForeverReminders/ForeverReminders.lua
import { config } from "./config";
import { runAll } from "./framework";
import "./specs/index";

const [addonPath] = [...$vararg] as string[];
if (addonPath === undefined) {
    print("usage: luajit tests.lua <path to ForeverReminders.lua>");
    os.exit(2);
}
config.addonPath = addonPath;
os.exit(runAll() ? 0 : 1);
