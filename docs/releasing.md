# Releasing an addon

Each addon has its own CurseForge project. A release is a zip of the built addon, made by GitHub Actions when a tag is
pushed, and uploaded by hand to that project.

| Addon | CurseForge project ID | Tag |
|---|---|---|
| Glowing Bars | (set in the TOC once the project exists) | `glowing-bars-v<version>` (a version like `1.0.0-beta.1` is uploaded as a Beta) |

The four addons it replaced were released at their tags, the last ones as `1.0.2`: `buff-reminder-v1.0.2` (CurseForge
project 1751392), `rank-reminder-v1.0.2` (1751395), `reagent-reminder-v1.0.2` (1751397) and `know-your-rotation-v1.0.2`
(1745557). Their folders are gone from `main`; check a tag out to see or rebuild one.

The project ID is the `## X-Curse-Project-ID` line of the addon's TOC.

## Releasing

1. Set the new `version` in `addons/<addon>/package.json` (it goes into the TOC) and commit and push it.
2. Tag the commit and push the tag:

   ```
   git tag glowing-bars-v1.0.0
   git push origin glowing-bars-v1.0.0
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
pnpm zip                                   # every released addon
pnpm --filter ./addons/glowing-bars zip   # one addon
```

The zip and `changelog.md` are written to `addons/<addon>/dist/`.
