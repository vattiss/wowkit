// The action bars (which spell is on which slot) and the auras on the player and the party.
import type { ClientState, FakeAura } from "./client-state";
import { defineGlobals, defineNamespace } from "./define";
import type { FrameRegistry } from "./frames";

const MAIN_BAR_BUTTONS = 12;
const TOTEM_BAR_BUTTONS = 4;
/** The action slot of MultiCastActionButton1. */
export const TOTEM_BAR_FIRST_SLOT = 133;

/** The bars 2 to 8 and the action slot of their first button. */
const OTHER_BARS: [bar: string, firstSlot: number][] = [
    ["MultiBarBottomLeft", 61],
    ["MultiBarBottomRight", 49],
    ["MultiBarRight", 25],
    ["MultiBarLeft", 37],
    ["MultiBar5", 145],
    ["MultiBar6", 157],
    ["MultiBar7", 169],
];

export function installActionBars(state: ClientState, frames: FrameRegistry): void {
    defineNamespace<typeof C_ActionBar>("C_ActionBar", {
        HasAction: (slot) => state.bars[slot] !== undefined,
        GetActionTexture: (slot) => state.spells[state.bars[slot] ?? 0]?.icon ?? 0,
        // The bar does not answer: the addon then asks the spell
        IsActionInRange: () => undefined,
    });
    defineGlobals({
        GetActionInfo: (slot) => {
            const spellId = state.bars[slot];
            if (spellId === undefined) return $multi(undefined, undefined, undefined, undefined);
            return $multi("spell", spellId, undefined, spellId);
        },
        GetTotemInfo: (slot) => {
            const totem = state.totems[slot];
            if (!totem) return $multi(false, "", 0, 0, 0, 0, 0);
            return $multi(true, totem.name, totem.start, totem.duration, 0, 0, 0);
        },
        GetMacroSpell: () => undefined,
        GetMacroBody: () => undefined,
    });

    // Blizzard's own action buttons: ActionButton1..12, each on its action slot
    for (let slot = 1; slot <= MAIN_BAR_BUTTONS; slot++) {
        frames.create("Button", `ActionButton${slot}`).action = slot;
    }
    // The other bars of Edit Mode (2 to 8): their buttons, on the action slots the game gives each
    for (const [bar, firstSlot] of OTHER_BARS) {
        for (let index = 1; index <= MAIN_BAR_BUTTONS; index++)
            frames.create("Button", `${bar}Button${index}`).action = firstSlot + index - 1;
    }
    // The shaman's totem bar: MultiCastActionButton1..4 on the action slots after the main bar's pages
    for (let index = 1; index <= TOTEM_BAR_BUTTONS; index++) {
        frames.create("Button", `MultiCastActionButton${index}`).action = TOTEM_BAR_FIRST_SLOT + index - 1;
    }
}

export function installAuras(state: ClientState): void {
    function toAuraData(aura: FakeAura, isHelpful: boolean): AuraData {
        return {
            auraInstanceID: 0,
            name: aura.name,
            spellId: aura.spellId,
            icon: 0,
            applications: aura.stacks ?? 1,
            duration: 0,
            expirationTime: aura.expirationTime,
            isHelpful,
            sourceUnit: aura.sourceUnit as UnitToken | undefined,
            dispelName: aura.dispelName,
            isStealable: aura.isStealable === true,
        };
    }

    /** What the game lets the addon see of the player's auras: nothing while they are hidden. */
    function listPlayerAuras(): FakeAura[] {
        return state.areAurasHidden ? [] : state.auras;
    }

    /** The buffs or the debuffs of a unit. */
    function listUnitAuras(unit: UnitToken, isHarmful: boolean): FakeAura[] {
        if (unit === "target") return (isHarmful ? state.target?.debuffs : state.target?.buffs) ?? [];
        if (unit === "player") return isHarmful ? state.playerDebuffs : listPlayerAuras();
        const [digit] = string.match(unit, "^party(%d)$");
        return digit !== undefined && !isHarmful ? (state.party[tonumber(digit)! - 1]?.auras ?? []) : [];
    }

    /** The auras of a unit by filter: buffs ("HELPFUL"), debuffs ("HARMFUL"), the player's own debuffs ("HARMFUL|PLAYER"). */
    function listAurasOf(unit: UnitToken, filter: string | undefined): FakeAura[] {
        const has = (word: string) => filter !== undefined && string.find(filter, word, 1, true)[0] !== undefined;
        const auras = listUnitAuras(unit, has("HARMFUL"));
        return has("PLAYER") ? auras.filter((aura) => aura.sourceUnit === "player") : auras;
    }

    defineNamespace<typeof C_UnitAuras>("C_UnitAuras", {
        GetAuraDataByIndex: (unit, index, filter) => {
            const aura = listAurasOf(unit, filter as string | undefined)[index - 1];
            return aura ? toAuraData(aura, filter !== "HARMFUL" && filter !== "HARMFUL|PLAYER") : undefined;
        },
        GetPlayerAuraBySpellID: (spellId) => {
            const aura = listPlayerAuras().find((candidate) => candidate.spellId === spellId);
            return aura ? toAuraData(aura, true) : undefined;
        },
        GetAuraDataBySpellName: (unit, spellName, filter) => {
            const aura = listAurasOf(unit, (filter as string | undefined) ?? "HELPFUL").find((candidate) => candidate.name === spellName);
            return aura ? toAuraData(aura, filter !== "HARMFUL" && filter !== "HARMFUL|PLAYER") : undefined;
        },
    });
}
