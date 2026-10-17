// The player and the party: who they are, whether they fight, rest, are alive and in range.
import type { ClientState, FakePartyMember } from "./client-state";
import { defineGlobals } from "./define";

export function installUnits(state: ClientState): void {
    /** party1..party4 are the members of the test's party, the player is everyone else. */
    function findMember(unit: UnitToken): FakePartyMember | undefined {
        const [digit] = string.match(unit, "^party(%d)$");
        return digit !== undefined ? state.party[tonumber(digit)! - 1] : undefined;
    }

    defineGlobals({
        UnitClass: (unit) => {
            const member = findMember(unit);
            if (member) return $multi(member.classToken, member.classToken, 0);
            return $multi(state.character.name, state.character.token, state.character.id);
        },
        UnitClassBase: (unit) => {
            const member = findMember(unit);
            if (member) return $multi(member.classToken, 0);
            return $multi(state.character.token, state.character.id);
        },
        UnitName: (unit) => $multi(findMember(unit)?.name ?? "Me", ""),
        UnitLevel: () => 60,
        UnitExists: (unit) => (unit === "raid1" ? state.isInRaid : findMember(unit as UnitToken) !== undefined),
        UnitIsConnected: () => true,
        UnitIsVisible: () => true,
        UnitIsUnit: (unit, other) => unit === other,
        UnitIsDeadOrGhost: (unit) => findMember(unit)?.isDead === true,
        UnitInRange: () => $multi(true, true),
        UnitPowerType: (unit) => $multi(findMember(unit)?.power ?? 0, "POWER", undefined, undefined, undefined),
        UnitAffectingCombat: () => state.isInCombat,
        UnitOnTaxi: () => false,
        IsMounted: () => false,
        IsResting: () => state.isResting,
        IsSwimming: () => false,
        GetInventoryItemID: (_unit, slot) => state.equippedItems[slot],
        GetNumShapeshiftForms: () => 0,
        GetBuildInfo: () => $multi("1.60.1", "70425", "Oct 16 2026", 16001, "1.60.1 (70425)", "1.60.1"),
        // Nothing is being cast; the addon then finds no cast name
        UnitCastingInfo: (() => $multi()) as unknown as typeof UnitCastingInfo,
        // The game's secret values: this fake game never hides one (the aura tests hide the whole list instead)
        issecretvalue: () => false,
        canaccessvalue: () => true,
    });
}
