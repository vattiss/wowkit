# 0004: The SDK is compiled into each addon, not installed as a shared addon

Status: proposed (2026-10-17)

## Context

Lua addons often share code through a library addon that players must also install (Ace3, LibStub).
TypeScriptToLua can instead bundle all the code an addon uses into the addon's own Lua file.

## Proposal

The SDK is an npm package (TypeScript source). An addon imports it, and TypeScriptToLua bundles the
parts it uses into the addon's single Lua file. Players install one addon and nothing else.

## Consequences

- No "also install library X" for players; no version clashes between addons using different SDK versions.
- Each addon carries its own copy. For scale: this addon's whole bundle, including the TypeScriptToLua
  helper library, is about 140 KB of Lua. Whether the SDK keeps that acceptable should be measured when
  layer 2 grows.
- An unused part of the SDK costs nothing if it is not imported.
