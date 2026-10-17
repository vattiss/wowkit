// Spells, the spellbook and spell tooltips.
import type { ClientState, SpellDefinition } from "./client-state";
import { defineNamespace, fake } from "./define";

export function installSpells(state: ClientState): void {
    function toSpellInfo(spell: SpellDefinition): SpellInfo {
        return { name: spell.name, iconID: spell.icon, originalIconID: spell.icon, castTime: 0, minRange: 0, maxRange: 0, spellID: spell.id };
    }

    /** The spell by ID, or by name: then the highest rank, like the game. */
    function findSpell(idOrName: number | string): SpellDefinition | undefined {
        if (type(idOrName) === "number") return state.spells[idOrName as number];
        let best: SpellDefinition | undefined;
        for (const [, spell] of pairs(state.spells)) {
            if (spell.name === idOrName && (best === undefined || spell.rank > best.rank)) best = spell;
        }
        return best;
    }

    /** The spellbook lists the learned spells, sorted by ID. */
    function listSpellBook(): SpellDefinition[] {
        const ids: number[] = [];
        for (const [id] of pairs(state.knownSpells)) ids.push(id);
        ids.sort((a, b) => a - b);
        return ids.map((id) => state.spells[id]!);
    }

    defineNamespace<typeof C_Spell>("C_Spell", {
        GetSpellInfo: (idOrName) => {
            const spell = findSpell(idOrName);
            return spell ? toSpellInfo(spell) : undefined;
        },
        GetSpellSubtext: (idOrName) => {
            const spell = findSpell(idOrName);
            return spell ? `Rank ${spell.rank}` : undefined;
        },
        GetOverrideSpell: (idOrName) => (type(idOrName) === "number" ? (idOrName as number) : 0),
        IsSpellInRange: (_spell, unit) => {
            const [digit] = string.match(unit ?? "", "^party(%d)$");
            return digit !== undefined ? state.party[tonumber(digit)! - 1]?.isOutOfRange !== true : true;
        },
        IsSpellUsable: (idOrName) => {
            const isUnusable = state.unusableSpells[idOrName as number] === true;
            return $multi(!isUnusable, isUnusable);
        },
        GetSpellTexture: (idOrName) => {
            const icon = findSpell(idOrName)?.icon;
            return $multi(icon, icon, undefined);
        },
    });

    defineNamespace<typeof C_SpellBook>("C_SpellBook", {
        IsSpellKnown: (spellId) => state.knownSpells[spellId] === true,
        IsSpellInSpellBook: (spellId) => state.knownSpells[spellId] === true,
        GetNumSpellBookSkillLines: () => 1,
        GetSpellBookSkillLineInfo: () => fake<SpellBookSkillLineInfo>({ itemIndexOffset: 0, numSpellBookItems: listSpellBook().length }),
        GetSpellBookItemInfo: (slot, bank) => {
            if (bank !== Enum.SpellBookSpellBank.Player) return undefined;
            const spell = listSpellBook()[slot - 1];
            return spell ? fake<SpellBookItemInfo>({ name: spell.name, spellID: spell.id, itemType: Enum.SpellBookItemType.Spell }) : undefined;
        },
        GetSpellBookItemName: () => $multi(undefined, undefined),
        FindSpellBookSlotForSpell: () => $multi(undefined, undefined),
    });

    defineNamespace<typeof C_TooltipInfo>("C_TooltipInfo", {
        GetInventoryItem: () => fake<TooltipData>({ lines: [] }),
        GetSpellByID: (spellId) => {
            const lines = [{ leftText: state.spells[spellId as number]?.name ?? "?" }];
            const reagent = state.reagentTexts[spellId as number];
            if (reagent !== undefined) lines.push({ leftText: `Reagents: ${reagent}` });
            return fake<TooltipData>({ lines });
        },
    });

    defineNamespace<typeof C_AddOns>("C_AddOns", {
        GetAddOnMetadata: () => "test",
    });
}
