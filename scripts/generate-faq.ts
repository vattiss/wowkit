// Writes the common questions of an addon (its faq.md) into its source, for the Help tab of its settings:
// src/options/faq.generated.ts. Each "### " heading is a question, the lines under it its answer, as the game shows them
// (see lib/game-markdown.ts). An addon without a faq.md gets none.
//
//   node ../../scripts/generate-faq.ts      (from the addon's folder, as its build does)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { convertLines, convertWords } from "./lib/game-markdown.ts";
import { getAddonDir } from "./lib/paths.ts";

const addonDir = getAddonDir();
const faqFile = `${addonDir}/faq.md`;
const outDir = `${addonDir}/src/options`;

/** The questions of the Markdown in order, each with the lines under it up to the next one. */
function listQuestions(markdown: string): { question: string; answer: string }[] {
    const questions: { question: string; lines: string[] }[] = [];
    for (const line of markdown.split(/\r?\n/)) {
        const heading = /^###\s+(.*)$/.exec(line);
        if (heading !== null) questions.push({ question: convertWords(heading[1]!.trim()), lines: [] });
        else questions.at(-1)?.lines.push(line);
    }
    return questions.map(({ question, lines }) => ({ question, answer: convertLines(lines) }));
}

if (existsSync(faqFile)) {
    const questions = listQuestions(readFileSync(faqFile, "utf8"));
    const entries = questions.map((faq) => `    { question: ${JSON.stringify(faq.question)}, answer: ${JSON.stringify(faq.answer)} },`);
    const source = `// Written by scripts/generate-faq.ts from faq.md, at each build: not to be edited by hand.

export interface Faq {
    question: string;
    /** The answer as the game shows it. */
    answer: string;
}

/** The common questions, in the order of faq.md. */
export const FAQS: Faq[] = [
${entries.join("\n")}
];
`;
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/faq.generated.ts`, source);
    console.log(`Wrote ${questions.length} questions to ${outDir}/faq.generated.ts`);
}
