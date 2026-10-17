# 0001: Build our own TypeScript SDK for Forever addons

Status: accepted (2026-10-17)

## Goal

Writing a World of Warcraft: Forever addon should be easy in a modern language: TypeScript, with the
game's API wrapped into a simple layer. The result is meant for everyone, not only for this addon.

## Options considered

- **A. Our own SDK**, extracted from this repository: typings generated from Blizzard's documentation, a
  friendly API on top, a test kit with a fake game, and rule checks.
- **B. Existing declarations plus our own tests.** The ones found are for other versions: [wartoshika/wow-declarations](https://github.com/wartoshika/wow-declarations)
  (retail, hand-written, last release seen 2022), [@araxiaonline/wow-wotlk-declarations](https://www.npmjs.org/package/@araxiaonline/wow-wotlk-declarations)
  (Wrath 3.3.5, for server scripting).
- **C. A UI layer on top**, e.g. [react-wow-addon](https://classic.yarnpkg.com/en/package/@brusalk/react-wow-addon)
  (its readme still says usage is a TODO).

TSWoW is server-side tooling for the Wrath emulator, not client addons.

The search was quick and not exhaustive; maintenance of the projects above was not verified.

## Decision

**A.** Nothing found covers Forever, keeps up with its changing API, or offers a typed fake game for tests.
This repository already contains the pieces; they get separated from the addon step by step.

## Consequences

- We own the upkeep: every Forever build can change the API (see 0006 for how much of it is automated).
- The addon in this repository stays the first user of the SDK and the reference for how to use it.
