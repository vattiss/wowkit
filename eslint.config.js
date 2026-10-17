// ESLint: the standard TypeScript rules, plus the limits and names that keep the code easy to read.
// `npm run check` runs it; `npm run lint -- --fix` fixes what can be fixed by itself.
//
// What it does not check (scripts/check-names.ts and scripts/check-boundary.ts do): that a function
// name starts with a verb, and that only src/wow/ and src/ui/ touch the Blizzard API.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/** A boolean reads as a question: isFound, hasArrived, shouldRecheckDrop, showBuff. */
const QUESTION_WORDS = ["is", "has", "can", "should", "does", "did", "was", "will", "are", "had", "show", "hide"];

export default defineConfig(
    { ignores: ["dist/**", ".cache/**", "node_modules/**", "types/**", "test/**"] },
    {
        files: ["src/**/*.ts", "scripts/**/*.ts"],
        extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.json", "./tsconfig.scripts.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            eqeqeq: "error",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            // The Lua tables of this addon are index signatures and `{ [key: string]: T }` reads fine
            "@typescript-eslint/consistent-indexed-object-style": "off",

            // Size limits. They warn for now: a few functions are still longer than the target and
            // are on the list to be split (the event list, the weapon reminder, the spellbook rebuild).
            "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
            "max-lines-per-function": ["warn", { max: 60, skipBlankLines: true, skipComments: true }],
            complexity: ["warn", 12],
        },
    },
    {
        // The names in src/ are ours. The scripts mirror Blizzard's data and Node's option names.
        // Object literal properties are left out for the same reason (`{ recursive: true }`).
        files: ["src/**/*.ts"],
        rules: {
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: ["variable", "parameter", "typeProperty", "classProperty", "accessor"],
                    types: ["boolean"],
                    format: ["PascalCase"],
                    prefix: QUESTION_WORDS,
                },
            ],
        },
    },
);
