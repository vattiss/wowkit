// Markdown as the game's text: a "### " heading gold, a "- item" a bullet, **bold** and `code` plain words, a "|" doubled
// (the game's escape character). Shared by the release notes and the common questions.

/** The gold of the game's own headings. */
const HEADING_COLOR = "ffd100";

/** Words as the game shows them: no Markdown marks, the game's escape character doubled. */
export function convertWords(words: string): string {
    return words.replaceAll("**", "").replaceAll("`", "").replaceAll("|", "||");
}

/** One line of Markdown as the game shows it; undefined for a title line ("## Glowing Bars 2.4.1"). */
export function convertLine(line: string): string | undefined {
    if (/^##\s/.test(line)) return undefined;
    const plain = convertWords(line);
    const heading = /^###\s+(.*)$/.exec(plain);
    if (heading !== null) return `|cff${HEADING_COLOR}${heading[1]}|r`;
    return plain.replace(/^-\s+/, "• ");
}

/** Lines of Markdown as the game's text, the title left out and the blank lines at the ends trimmed. */
export function convertLines(lines: string[]): string {
    return lines
        .map(convertLine)
        .filter((line): line is string => line !== undefined)
        .join("\n")
        .trim();
}
