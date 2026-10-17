import ts from "typescript";
import { ROOT, listAddons } from "./paths.ts";

/**
 * One TypeScript program with the files of every addon (and so of the packages they use), for the checks that read
 * the code. The addons share their compiler options, so the first one's are used.
 */
export function createAddonsProgram(): ts.Program {
    const fileNames = new Set<string>();
    let options: ts.CompilerOptions | undefined;
    for (const addon of listAddons()) {
        const config = ts.getParsedCommandLineOfConfigFile(
            `${ROOT}${addon}/tsconfig.json`,
            {},
            { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
        );
        if (!config) throw new Error(`${addon}/tsconfig.json not found`);
        options ??= config.options;
        for (const file of config.fileNames) fileNames.add(file);
    }
    if (!options) throw new Error("no addons found under addons/");
    return ts.createProgram([...fileNames], options);
}
