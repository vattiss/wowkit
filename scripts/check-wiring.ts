// Fails when a service is written but never made in an addon's src/addon.ts.
//
// A service that another service needs cannot be forgotten: the code that needs it would not compile. A
// service that only reacts to events (a greeting, a sound) is needed by nobody, so forgetting it would be
// silent: it compiles, the tests pass, and it never runs. This lists every class in a *.service.ts, *.page.ts
// or *.section.ts file of an addon and checks that the addon's addon.ts makes it with `new`. The services of the
// packages are not checked: each addon picks the ones it needs.
//
//   node scripts/check-wiring.ts
import { readdirSync, readFileSync } from "node:fs";
import { ROOT, listAddons } from "./lib/paths.ts";

const SERVICE_FILE = /\.(service|page|section)\.ts$/;

/** Every .ts file under a folder, as a path from the project root. */
function listFiles(folder: string): string[] {
    return readdirSync(`${ROOT}${folder}`, { withFileTypes: true }).flatMap((entry) => {
        const path = `${folder}/${entry.name}`;
        if (entry.isDirectory()) return listFiles(path);
        return entry.name.endsWith(".ts") ? [path] : [];
    });
}

const problems: string[] = [];
let serviceCount = 0;
for (const addon of listAddons()) {
    const wiringFile = `${addon}/src/addon.ts`;
    const wiring = readFileSync(`${ROOT}${wiringFile}`, "utf8");
    for (const file of [`${addon}/src`].flatMap(listFiles).filter((path) => SERVICE_FILE.test(path))) {
        for (const match of readFileSync(`${ROOT}${file}`, "utf8").matchAll(/^export class (\w+)/gm)) {
            serviceCount++;
            if (!wiring.includes(`new ${match[1]}(`) && !wiring.includes(`new ${match[1]}<`))
                problems.push(`${match[1]} (${file}) is never made in ${wiringFile}`);
        }
    }
}

if (problems.length > 0) {
    console.error(`${problems.length} services are missing from an addon.ts:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}
console.log(`ok: all ${serviceCount} services are made in their addon's addon.ts`);
