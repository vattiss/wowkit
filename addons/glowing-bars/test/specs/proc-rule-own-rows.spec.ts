// A spell's own row on the Procs tab while the proc rules are on: shown only while one of its rules has no group (its look
// is then the one a glow of that rule shows). A spell whose rules all have a group has their rows alone, and the switch of
// its own row, hidden, no longer counts.
import { createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";
import { findLabelOnTab, showTab, toggleTable } from "./table.helpers";

const WARLOCK = { name: "Warlock", token: "WARLOCK", id: 9 };
const SHADOW_BOLT: SpellDefinition = { id: 686, name: "Shadow Bolt", rank: 1, icon: 136197, maxRange: 30, isHarmful: true, castTimeMs: 0 };
const REVENGE: SpellDefinition = { id: 6572, name: "Revenge", rank: 1, icon: 132353, isHarmful: true, cooldownSeconds: 5 };

/** A warlock with an instant Shadow Bolt on button 1 (the backup rule lights it). */
function createWarlock(saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, WARLOCK);
        learnSpell(state, SHADOW_BOLT);
        state.bars[1] = SHADOW_BOLT.id;
    }, saved);
    world.advance(1);
    return world;
}

function openProcs(world: World): void {
    toggleTable();
    showTab(world, "Procs");
}

describe("a spell's own row on the Procs tab with the proc rules on", () => {
    it("is left out for Shadow Bolt, whose two rules have a group each: their two rows alone", () => {
        const world = createWarlock({ shouldUseProcRules: true });
        openProcs(world);
        expect(findLabelOnTab(world, "Shadow Bolt (CDM)")).toBeDefined();
        expect(findLabelOnTab(world, "Shadow Bolt (backup)")).toBeDefined();
        expect(findLabelOnTab(world, "Shadow Bolt")).toBeUndefined();
        toggleTable();
    });

    it("stays without the rules, and with a rule of no group", () => {
        const off = createWarlock({ shouldUseProcRules: false });
        openProcs(off);
        expect(findLabelOnTab(off, "Shadow Bolt")).toBeDefined();
        toggleTable();
        const own = createWarlock({
            shouldUseProcRules: true,
            procRules: [{ spellId: SHADOW_BOLT.id, kind: "usable", result: "glow", priority: 3 }],
        });
        openProcs(own);
        expect(findLabelOnTab(own, "Shadow Bolt")).toBeDefined();
        toggleTable();
    });

    it("stays for Revenge, whose rules have no group", () => {
        const world = createWorld(
            (state) => {
                playAs(state, WARRIOR);
                learnSpell(state, REVENGE);
                state.bars[1] = REVENGE.id;
            },
            { shouldUseProcRules: true },
        );
        world.advance(1);
        openProcs(world);
        expect(findLabelOnTab(world, "Revenge")).toBeDefined();
        toggleTable();
    });

    it("no longer keeps the spell dark by its switch once hidden: the groups' switches alone count", () => {
        const switchedOff = { [String(SHADOW_BOLT.id)]: false };
        expect(createWarlock({ shouldUseProcRules: true, enabledSpells: switchedOff }).glowsOn(1)).toBe(1);
        expect(createWarlock({ shouldUseProcRules: true, enabledSpells: { "group:Shadow Bolt:backup": false } }).glowsOn(1)).toBe(0);
        expect(createWarlock({ shouldUseProcRules: false, enabledSpells: switchedOff }).glowsOn(1)).toBe(0);
    });
});
