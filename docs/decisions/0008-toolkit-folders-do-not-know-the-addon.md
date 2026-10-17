# 0008: The toolkit does not know the addon

Status: accepted (2026-10-17)

## Context

The long-term plan is an SDK that other Forever addons can use ([0001](0001-own-sdk-for-forever-addons.md)),
cut out of this addon ([packages.md](../packages.md)). Cutting it out later is
hard when the general code quietly imports addon code: `toolkit/wow/notice.ts` knew the addon's texts and sound
settings, `toolkit/wow/auras.ts` imported the addon's buff categories, `toolkit/wow/spells.ts` its spell name table.

## Decision

`src/toolkit/` (`framework/`, `wow/`, `util/`) is the **toolkit** and may import only itself.
`scripts/check-layers.ts` (part of `npm run check`) fails on any other import.

What the toolkit needs but cannot know is asked for with an **injection token** (`toolkit/wow/wow.constants.ts`), and the
addon's modules provide it ([0009](0009-everything-is-a-provider.md)):

| Toolkit asks for | The addon provides | In |
|---|---|---|
| `AURA_KNOWLEDGE` | buff categories and durations (`BuffKnowledgeService`) | `knowledge/knowledge.module.ts` |
| `SPELL_NAME_HINTS` | English spell names for IDs the client does not name | `knowledge/knowledge.module.ts` |
| `SAVED_VARIABLES` | the name of the saved variable the TOC declares | `settings/settings.module.ts` |

The toolkit marks them `@Optional()` where it can work without (no categories, no hints).

Things that were in the toolkit but belong to the addon moved out: the chat line in the addon's name and the
list of alert sounds (`messages/`), the weapon buff read as an aura (`reminders/weapon/weapon-reading.service.ts`).
The game's own constants (weapon slots, "no expiry") moved into `toolkit/wow/wow.constants.ts`.

## Not decided here

The folders are not moved or packaged yet. The generic part of `src/options/` (the controls and widgets) and of
`src/settings/` still lives with the addon; splitting it is the next step, and the physical move into
packages (npm workspaces, [0006](0006-tooling.md)) comes after that.

## Consequences

- The toolkit can be read, tested and later published without the addon.
- A new file in a toolkit folder that needs an addon thing fails `npm run check` and must ask for it with a token
  (and an `@Optional()` default where it makes sense).
