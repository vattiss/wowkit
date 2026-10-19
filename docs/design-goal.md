# Design goal

wowkit is a TypeScript layer for World of Warcraft: Forever addons that is written to be **read by people**. Most of
the code is written by an AI assistant now, and that is fine. The design makes sure a person can still read it,
review it, trust it and change it.

## Why readable code matters when an AI writes it

- **Reading is the human's job.** Typing is cheap. Deciding whether a change is right, and why, is what stays with a
  person. Code that is hard to read cannot be reviewed, so it ends up trusted without being checked.
- **An addon fails quietly.** The client hides values in combat, remaps spell IDs and raises errors on a harmless
  comparison. A bug shows as a glow that did not light up. Finding it means reading the code and following one
  question through it.
- **The code outlives the session that wrote it.** Whoever opens a file later, a person or the next AI session, starts
  without the conversation. The names, the folders and the written reasons have to carry that.

## How the code is made readable

A rule that only lives in a guide is broken sooner or later, so every rule below is either checked by a tool or is
simply how the files are laid out. `pnpm check` runs the checks, and CI runs the same ones.

| What the reader gets | How it is made | What enforces it |
|---|---|---|
| **Names read like English.** `findMissingBuffs`, `isInCombat`, `showNotice`. | Functions start with a verb, booleans read as questions. | `scripts/check-names.ts` and the naming rules of ESLint |
| **Small pieces.** A file or a function fits on a screen or two. | At most 300 lines a file, 60 lines a function, and a complexity of 12. | ESLint |
| **One job for each class, and no magic.** | Plain classes that ask for what they need in the constructor, made by hand in one `addon.ts`, dependencies first. No container, no inheritance, no decorators except for "this method listens to that event". | `scripts/check-wiring.ts` (every service is made in `addon.ts`) and the compiler (a missing dependency does not compile) |
| **The game's quirks in one place.** | Only a few folders talk to the game. They answer in plain words (`isLearned(spell)`), and never hand out a secret value. | `scripts/check-boundary.ts` |
| **The toolkit does not know the addons.** | Each package imports only itself and the packages below it. What only an addon knows is passed in. | `scripts/check-layers.ts` |
| **The IDs are real.** | Spell and item IDs are written once, by category, and a developer addon asks the client about each. | `scripts/check-ids.ts` and the `/wowkit` check |
| **Tests that read like sentences.** | "A priest who arrives in a town is told which reagents run low". They run the built addon in LuaJIT against a fake game. | `pnpm test` |
| **The reasons are written down.** | The choices that shaped the project are records, one each, with the reason. | [Architecture](architecture.md) |

The same rules apply to a change from a person and to one from an AI: it is done when `pnpm check` and `pnpm test`
pass.

## What it does not promise

Readable is not the same as correct. The rules keep the code easy to follow; they cannot tell what the real client does.
Whatever depends on the game, such as a cooldown the client hides in combat or a weapon enchant that can only be seen
on the weapon, has to be tried in the game. When one of those turns out different, the fix and the reason go into the
[game's quirks](forever-quirks.md).

## Where to go from here

- How the code is organised and why: [Architecture](architecture.md).
- What each package is for: [Packages and addons](packages.md).
- Writing an addon of your own: [Learning guide](learning-guide.md).
