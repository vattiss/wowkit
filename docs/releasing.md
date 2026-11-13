# Releasing an addon

Each addon has its own CurseForge and Wago project. A release is a zip of the built addon, made by GitHub Actions when a tag
is pushed, attached to a GitHub release and uploaded to both sites.

| Addon | CurseForge project ID | Wago ID | Tag |
|---|---|---|---|
| Glowing Bars | 1754997 | ZKbq1961 | `glowing-bars-v<version>` (a version like `1.0.0-beta.1` is uploaded as a Beta) |

The four addons it replaced were released at their tags, the last ones as `1.0.2`: `buff-reminder-v1.0.2` (CurseForge
project 1751392), `rank-reminder-v1.0.2` (1751395), `reagent-reminder-v1.0.2` (1751397) and `know-your-rotation-v1.0.2`
(1745557). Their folders are gone from `main`; check a tag out to see or rebuild one.

The project IDs are the `## X-Curse-Project-ID` and `## X-Wago-ID` lines of the addon's TOC.

The text of Glowing Bars' project page, the same on CurseForge and on Wago, is kept in
[glowing-bars-description.md](glowing-bars-description.md): change it there first, then paste it on both sites.

## Releasing

1. Set the new `version` in `addons/<addon>/package.json` (it goes into the TOC), write the release notes in
   `addons/<addon>/release-notes/<version>.md`, and commit and push them.
2. Tag the commit and push the tag:

   ```
   git tag glowing-bars-v1.0.0
   git push origin glowing-bars-v1.0.0
   ```

   [The release workflow](../.github/workflows/release.yml) stops if the tag's version is not the one in `package.json`.
   Otherwise it tests, builds that addon, and attaches `<AddonName>-<version>.zip` to a GitHub release, with the changelog
   as the release notes.
3. Then two jobs upload the zip, one to CurseForge and one to Wago
   ([upload-release.sh](../.github/scripts/upload-release.sh)), named as the zip, with the changelog, as a Release (stable
   on Wago) or, for a version like `1.0.0-beta.1`, a Beta. The game version follows the TOC's `## Interface` (16001 is
   Forever 1.60.1): CurseForge's WoW Forever version with that `apiVersion`, and Wago's Forever patch of that number. A
   site that does not have it yet is not uploaded to, and its job fails with what was missing; the GitHub release stays.

   Each site needs its token as a repository secret (*Settings > Secrets and variables > Actions*): `CF_API_KEY` from
   CurseForge's API Tokens, `WAGO_API_TOKEN` from Wago's API keys. Without one, that site is skipped. A token that may
   have leaked is revoked on its site and replaced in the secret.

The zip holds the folder `<AddonName>/`, the name the game loads. The changelog is the release notes of the version,
written for players: what is new, what changed, and what was fixed that was wrong in an earlier release (a fix of
something new in the same release is not news). Without a notes file it is the subjects of the commits since the addon's
previous tag that touched the addon or `packages/` (a change in a package is a change of every addon); with no earlier
tag the last 30 commits.

## When a release fails

- **An upload failed** (a site down, or without the new game version yet): *Re-run failed jobs* on the run runs that site's
  job again alone. The other site is not uploaded to twice, and the GitHub release stays as it is.
- **The release job failed** (a test, the build, a tool that would not install): nothing was published, as the uploads
  wait for it. *Re-run failed jobs* runs it again on the same tag; a GitHub release an earlier run made only gets the new
  zip.
- **The workflow itself needs a fix**: a run again uses the workflow of the tagged commit. Commit the fix, then move the tag
  to it (`git tag -f glowing-bars-v1.0.0` and `git push -f origin glowing-bars-v1.0.0`). That is harmless while nothing
  went up to CurseForge or Wago; once it did, release the fix as the next version instead.

## A beta

A version like `2.9.0-beta.1` is released the same way from `development`, without merging to `main`, and uploaded as a
Beta. Its GitHub release is marked as a pre-release. Its notes are the ones of the version it leads to,
`release-notes/2.9.0.md`: testers see them once in What's new, and not again when `2.9.0` comes out.

## Making a zip on your own machine

```
pnpm zip                                   # every released addon
pnpm --filter ./addons/glowing-bars zip   # one addon
```

The zip and `changelog.md` are written to `addons/<addon>/dist/`.
