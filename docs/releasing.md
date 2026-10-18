# Releasing an addon

Each addon has its own CurseForge project. A release is a zip of the built addon, made by GitHub Actions when a tag is
pushed, and uploaded by hand to that project.

| Addon | CurseForge project ID | Tag |
|---|---|---|
| Buff Reminder | 1751392 | `buff-reminder-v<version>` |
| Rank Reminder | 1751395 | `rank-reminder-v<version>` |
| Reagent Reminder | 1751397 | `reagent-reminder-v<version>` |

The project ID is the `## X-Curse-Project-ID` line of the addon's TOC.

## Releasing

1. Set the new `version` in `addons/<addon>/package.json` (it goes into the TOC) and commit and push it.
2. Tag the commit and push the tag:

   ```
   git tag buff-reminder-v1.0.0
   git push origin buff-reminder-v1.0.0
   ```

   [The release workflow](../.github/workflows/release.yml) stops if the tag's version is not the one in `package.json`.
   Otherwise it tests, builds that addon, and attaches `<AddonName>-<version>.zip` to a GitHub release, with the changelog
   as the release notes.
3. Download the zip from the release and upload it on the addon's CurseForge page (*Files > Upload file*), pasting the
   changelog.

The zip holds the folder `<AddonName>/`, the name the game loads. The changelog is the subjects of the commits since
the addon's previous tag that touched the addon or `packages/` (a change in a package is a change of every addon); with
no earlier tag it lists the last 30 commits, so trim it for a first release.

## Making a zip on your own machine

```
pnpm zip                                   # all three addons
pnpm --filter ./addons/buff-reminder zip   # one addon
```

The zip and `changelog.md` are written to `addons/<addon>/dist/`.
