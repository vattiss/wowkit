# 0006: Tooling

Status: accepted (2026-10-17)

| Area | Choice | Why |
|---|---|---|
| Compiler | TypeScriptToLua | already in use; the standard way from TypeScript to Lua |
| Lint | ESLint with typescript-eslint | needs type-aware rules (the boolean naming rule); Biome has none |
| Format | Prettier (`.prettierrc.json`; `npm run format` writes, `npm run check` checks; code, JSON and YAML, not Markdown) | one layout everywhere, no formatting noise in diffs |
| Repository | npm workspaces when the SDK is cut out of the addon | one place, shared tooling; separate repositories only if the SDK is published on its own |
| Release | BigWigs packager and a GitHub Action | later; CurseForge waits until the owner says the addon is done |
| CI | GitHub Actions: typecheck, checks, tests (`.github/workflows/ci.yml`; written, not yet run on GitHub) | catches a broken push without a person |

## Upkeep (what staying current costs)

- **Each Forever build:** the API may change. A scheduled GitHub Action runs the generator against the
  newest `forever` commit and opens a pull request with the changed typings; the person reviews it and
  fixes whatever the compiler then flags. Planned, not built yet.
- **Every few months:** update TypeScript, TypeScriptToLua, ESLint.
- **If the SDK is public:** answer issues and review contributions on a best-effort basis; versions
  are named after the game build they match.
