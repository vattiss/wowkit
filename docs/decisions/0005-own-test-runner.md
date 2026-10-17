# 0005: Keep our own `describe` / `it` runner on LuaJIT

Status: accepted (2026-10-17)

## Decision

The tests are TypeScript with `describe` / `it` / `expect`, compiled by TypeScriptToLua and run by
LuaJIT against the built addon, with a small runner of our own (`test/framework.ts`, about 150 lines).

## Why

- The game runs Lua 5.1; LuaJIT behaves the same. A Lua VM in Node would be 5.3 or 5.4.
- Authors write only TypeScript.
- The fake game is checked against the real API types, so it cannot drift silently.

## Rejected

- **busted** (the usual Lua runner): hard to install on Windows, and tests would be Lua.
- **Jest or Vitest with a Lua VM inside Node**: a nicer runner, but a different Lua than the game's.

## Consequences

- Features such as watch mode, coverage or `it.skip` are ours to add if they are wanted.
- A crash inside the addon points at a Lua line of the built file.
