// Fails when a package imports something it is not allowed to depend on.
//
// The packages are what could serve any Forever addon, so each may reach only itself and the packages it lists
// here. The addon is not a package: it may use all of them. What only the addon knows (buff categories, spell
// names, the saved variable) reaches a package as a constructor parameter, passed in by the addon.
//
//   node scripts/check-layers.ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import { ROOT } from "./lib/paths.ts";

/** Package folder -> the packages it may import (by name, as written in an import). */
const PACKAGES: Record<string, string[]> = {
    "packages/framework/src": [],
    "packages/wow/src": ["@forever/framework"],
    "packages/test-kit/src": [],
};
const ALIASES = ["@forever/framework", "@forever/wow", "@forever/test-kit"];

/** Every .ts file under a folder, as a path from the project root. */
function listFiles(folder: string): string[] {
    return readdirSync(`${ROOT}${folder}`, { withFileTypes: true }).flatMap((entry) => {
        const path = `${folder}/${entry.name}`;
        if (entry.isDirectory()) return listFiles(path);
        return entry.name.endsWith(".ts") ? [path] : [];
    });
}

/** What a file imports (import, import type, export ... from, declare module): relative paths and package names. */
function listImports(source: string): string[] {
    return [...source.matchAll(/\b(?:from|import|declare module)\s+"([^"]+)"/g)].map((match) => match[1]!);
}

const problems: string[] = [];
let fileCount = 0;
for (const [folder, allowed] of Object.entries(PACKAGES)) {
    for (const file of listFiles(folder)) {
        fileCount++;
        for (const specifier of listImports(readFileSync(`${ROOT}${file}`, "utf8"))) {
            if (specifier.startsWith(".")) {
                const target = posix.normalize(posix.join(dirname(file), specifier));
                if (!target.startsWith(`${folder}/`) && target !== folder)
                    problems.push(`${file} imports ${target}, which is outside its package`);
                continue;
            }
            const alias = ALIASES.find((name) => specifier === name || specifier.startsWith(`${name}/`));
            if (alias !== undefined && !allowed.includes(alias))
                problems.push(`${file} imports ${specifier}, which this package does not depend on`);
        }
    }
}

if (problems.length > 0) {
    console.error(`${problems.length} imports leave their package:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}
console.log(`ok: the ${fileCount} files of ${Object.keys(PACKAGES).length} packages import only what they depend on`);
