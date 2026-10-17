// Entry of the test bundle: luajit dist-test/tests.lua
import { runAll } from "@wowkit/test-kit";
import "./specs";

os.exit(runAll() ? 0 : 1);
