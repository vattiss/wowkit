# 0002: Support Forever only

Status: accepted (2026-10-17)

## Decision

The SDK targets the Forever client only. Its typings come from the `forever` branch of
[Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source/tree/forever), pinned to one commit and
versioned by the game build (now 1.60.1).

## Why

Forever has its own API surface and rules (for example secret values in combat). Supporting Classic or
Retail as well would mean testing against clients we do not play, and slow down every decision.

## Consequences

- Features that exist only on Forever can be used freely.
- The generator reads the branch from `package.json`, so another branch could be tried later; that is
  not a promise and not a goal.
