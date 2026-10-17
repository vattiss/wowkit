# 0003: Layered SDK: generated typings, a friendly API on top, the raw API always reachable

Status: proposed (2026-10-17)

## Context

The game's API has about 6,600 functions. Hand-wrapping all of them is not realistic, and not needed:
addon authors use a few dozen areas (units, spells, auras, items, action bars, events, timers, frames,
saved data) most of the time.

## Proposal

| Layer | What | How |
|---|---|---|
| 0 | Typings of the **whole** raw API | generated from Blizzard's documentation (exists) |
| 1 | The raw calls made **safe**: secret values, errors, hidden data handled once | hand-written, informed by the documentation's metadata (see below) |
| 2 | A **friendly API** for the common areas: `isInCombat()`, `isLearned(spell)`, `getItemCount(item)` | hand-designed, grown from real addons (this repo's `src/toolkit/wow/` is the first draft) |
| 3 | **Helpers** for addon plumbing: options pages, slash commands, saved variables, texts | hand-written |
| 4 | The **test kit**: `describe` / `it`, a fake game checked against the real types | exists in `test/` |

Whatever is not wrapped stays reachable through layer 0, so "wrap everything" never blocks anyone.

## What the documentation can tell us about secret values (measured 2026-10-17, build 1.60.1)

Of 6,617 documented functions, 4,100 carry some secrecy key, but 3,949 of those are `SecretArguments`, a
statement about passing secret values *in*. The keys that say a *result* may be secret are far fewer:
about 300 functions (`SecretReturns*`, `SecretWhen*`, `ConstSecretAccessor`). 280 functions are marked
`HasRestrictions` and 74 as protected. So a generator can mark about 300 results as "may be secret" and
the protected functions precisely; for the rest, layer 1 has to stay careful by default.

## Consequences

- Layer 2 is designed from at least two or three real addons, not from one.
- The generator grows a step that turns the secrecy and restriction keys into types or documentation.
