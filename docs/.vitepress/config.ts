// The documentation site: the markdown of docs/ plus the TypeDoc API reference (docs/public/api, made by `pnpm docs:api`).
// `pnpm docs:build` makes the site in docs/.vitepress/dist; .github/workflows/docs.yml publishes it to GitHub Pages.
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const REPOSITORY = "https://github.com/vattiss/wowkit";

export default withMermaid(
    defineConfig({
        title: "wowkit",
        description: "TypeScript packages and addons for World of Warcraft: Forever",
        // GitHub Pages serves the site under /<repository>/
        base: "/wowkit/",
        cleanUrls: true,
        lastUpdated: true,
        // The API reference is plain HTML made by TypeDoc, so VitePress does not know it
        ignoreDeadLinks: [/^\/wowkit\/api\//, /\/api\//],
        themeConfig: {
            nav: [
                { text: "Getting started", link: "/getting-started" },
                { text: "Learning guide", link: "/learning-guide" },
                { text: "Architecture", link: "/architecture" },
                { text: "API", link: "/api/index.html", target: "_self" },
            ],
            sidebar: [
                {
                    text: "Start here",
                    items: [
                        { text: "Getting started", link: "/getting-started" },
                        { text: "Learning guide", link: "/learning-guide" },
                    ],
                },
                {
                    text: "How it is built",
                    items: [
                        { text: "Architecture", link: "/architecture" },
                        { text: "Packages and addons", link: "/packages" },
                        { text: "Glossary", link: "/glossary" },
                        { text: "The game's quirks", link: "/forever-quirks" },
                    ],
                },
                {
                    text: "Working on it",
                    items: [{ text: "Releasing an addon", link: "/releasing" }],
                },
                {
                    text: "Reference",
                    items: [{ text: "API reference", link: "/api/index.html", target: "_self" }],
                },
            ],
            socialLinks: [{ icon: "github", link: REPOSITORY }],
            editLink: { pattern: `${REPOSITORY}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
            search: { provider: "local" },
            footer: { message: "Released under the MIT license.", copyright: "Attila Varga" },
        },
        markdown: {
            config(md) {
                // A link from a page to a file outside docs/ (../addons/..., ../.github/...) points to the file on GitHub
                const openLink = md.renderer.rules.link_open;
                md.renderer.rules.link_open = (tokens, index, options, env, self) => {
                    const token = tokens[index]!;
                    const href = token.attrGet("href");
                    if (href?.startsWith("../")) token.attrSet("href", `${REPOSITORY}/blob/main/${href.replace(/^(\.\.\/)+/, "")}`);
                    return openLink ? openLink(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
                };
            },
        },
        mermaid: {},
    }),
);
