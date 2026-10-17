// The action bars (which spell is on which slot) and the auras on the player and the party.
import type { ClientState, FakeAura } from "./client-state";
import { defineGlobals, defineNamespace } from "./define";
import type { FrameRegistry } from "./frames";

const MAIN_BAR_BUTTONS = 12;

export function installActionBars(state: ClientState, frames: FrameRegistry): void {
    defineNamespace<typeof C_ActionBar>("C_ActionBar", {
        HasAction: (slot) => state.bars[slot] !== undefined,
        GetActionTexture: (slot) => state.spells[state.bars[slot] ?? 0]?.icon ?? 0,
    });
    defineGlobals({
        GetActionInfo: (slot) => {
            const spellId = state.bars[slot];
            if (spellId === undefined) return $multi(undefined, undefined, undefined, undefined);
            return $multi("spell", spellId, undefined, spellId);
        },
        GetMacroSpell: () => undefined,
        GetMacroBody: () => undefined,
    });

    // Blizzard's own action buttons: ActionButton1..12, each on its action slot
    for (let slot = 1; slot <= MAIN_BAR_BUTTONS; slot++) {
        frames.create("Button", `ActionButton${slot}`).action = slot;
    }
}

export function installAuras(state: ClientState): void {
    function toAuraData(aura: FakeAura): AuraData {
        return {
            auraInstanceID: 0,
            name: aura.name,
            spellId: aura.spellId,
            icon: 0,
            applications: 1,
            duration: 0,
            expirationTime: aura.expirationTime,
            isHelpful: true,
            sourceUnit: aura.sourceUnit as UnitToken | undefined,
        };
    }

    /** What the game lets the addon see of the player's auras: nothing while they are hidden. */
    function listPlayerAuras(): FakeAura[] {
        return state.areAurasHidden ? [] : state.auras;
    }

    function listAurasOf(unit: UnitToken): FakeAura[] {
        const [digit] = string.match(unit, "^party(%d)$");
        return digit !== undefined ? (state.party[tonumber(digit)! - 1]?.auras ?? []) : listPlayerAuras();
    }

    defineNamespace<typeof C_UnitAuras>("C_UnitAuras", {
        GetAuraDataByIndex: (unit, index) => {
            const aura = listAurasOf(unit)[index - 1];
            return aura ? toAuraData(aura) : undefined;
        },
        GetPlayerAuraBySpellID: (spellId) => {
            const aura = listPlayerAuras().find((candidate) => candidate.spellId === spellId);
            return aura ? toAuraData(aura) : undefined;
        },
        GetAuraDataBySpellName: (_unit, spellName) => {
            const aura = listPlayerAuras().find((candidate) => candidate.name === spellName);
            return aura ? toAuraData(aura) : undefined;
        },
    });
}
