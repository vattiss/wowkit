// The utility cooldowns besides the racials: the shaman's Astral Recall, and the Hearthstone, an item that counts only on a
// bar. Each glows anywhere, once as it is ready.
import { createWorld, describe, expect, it, learnSpell, playAs, SHAMAN, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";
import { findLabel, toggleTable } from "./table.helpers";

const ASTRAL_RECALL: SpellDefinition = { id: 556, name: "Astral Recall", rank: 1, icon: 136010, cooldownSeconds: 900 };
const HEARTHSTONE: SpellDefinition = { id: 8690, name: "Hearthstone", rank: 1, icon: 134414, cooldownSeconds: 3600 };
const HEARTHSTONE_ITEM = 6948;

function startFight(world: World): void {
    world.state.isInCombat = true;
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(0.5);
}

/** A warrior with the Hearthstone in the bags, on button 1 or on none. */
function createWithHearthstone(isOnBar: boolean): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        state.spells[HEARTHSTONE.id] = HEARTHSTONE;
        state.itemUseSpells[HEARTHSTONE_ITEM] = HEARTHSTONE.id;
        state.bags[HEARTHSTONE_ITEM] = 1;
        if (isOnBar) state.barItems[1] = HEARTHSTONE_ITEM;
    });
    world.advance(1);
    return world;
}

describe("Astral Recall, a shaman's utility cooldown", () => {
    it("glows once when ready, and not again as a fight starts", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            learnSpell(state, ASTRAL_RECALL);
            state.bars[1] = ASTRAL_RECALL.id;
        });
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        world.advance(3);
        startFight(world);
        expect(world.glowsOn(1)).toBe(0);
    });
});

describe("the Hearthstone, a utility cooldown on a bar", () => {
    it("glows once when ready, and not while on its cooldown", () => {
        expect(createWithHearthstone(true).glowsOn(1)).toBe(1);
        const world = createWithHearthstone(true);
        world.state.cooldowns[HEARTHSTONE.id] = { start: GetTime(), duration: 3600 };
        world.advance(4);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("has a row in the table on a bar, and none in the bags alone", () => {
        const onBar = createWithHearthstone(true);
        toggleTable();
        expect(findLabel(onBar, "Hearthstone")).not.toBe(undefined);
        toggleTable();
        const inBags = createWithHearthstone(false);
        toggleTable();
        expect(findLabel(inBags, "Hearthstone")).toBe(undefined);
        toggleTable();
    });
});

describe("the looks set for a utility cooldown while it was a ready cooldown", () => {
    const CULTIVATION: SpellDefinition = { id: 20552, name: "Cultivation", rank: 1, icon: 136099, cooldownSeconds: 900 };
    const RED = [1, 0, 0];

    function loginWith(saved: Record<string, unknown>): World {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            for (const spell of [CULTIVATION, ASTRAL_RECALL]) learnSpell(state, spell);
            state.bars[1] = CULTIVATION.id;
            state.bars[2] = ASTRAL_RECALL.id;
        }, saved);
        world.advance(1);
        return world;
    }

    it("move to the Utility cooldown type, the others stay, and a spell added as a ready cooldown moves too", () => {
        const world = loginWith({
            spellStyles: { "readyCooldown:Cultivation": { color: RED }, "readyCooldown:Recklessness": { glowTime: 5 } },
            addedSpells: [{ id: ASTRAL_RECALL.id, reminderType: "readyCooldown" }],
        });
        const saved = world.getSavedSettings()!;
        const looks = saved.spellStyles as Record<string, { color?: number[]; glowTime?: number } | undefined>;
        expect(looks["utilityCooldown:Cultivation"]?.color?.join(",")).toBe("1,0,0");
        expect(looks["readyCooldown:Cultivation"]).toBe(undefined);
        expect(looks["readyCooldown:Recklessness"]?.glowTime).toBe(5);
        const added = saved.addedSpells as { id: number; reminderType: string }[];
        expect(added.map((spell) => `${spell.id}:${spell.reminderType}`).join(",")).toBe(`${ASTRAL_RECALL.id}:utilityCooldown`);
        // Astral Recall glows once, in one type only
        expect(world.glowsOn(2)).toBe(1);
    });

    it("keep a look the new type has already, and move only once", () => {
        const world = loginWith({
            spellStyles: { "readyCooldown:Cultivation": { color: RED }, "utilityCooldown:Cultivation": { glowTime: 10 } },
            areUtilityLooksMoved: false,
        });
        const looks = world.getSavedSettings()!.spellStyles as Record<string, { color?: number[]; glowTime?: number } | undefined>;
        expect(looks["utilityCooldown:Cultivation"]?.glowTime).toBe(10);
        expect(looks["utilityCooldown:Cultivation"]?.color).toBe(undefined);
        expect(looks["readyCooldown:Cultivation"]).toBe(undefined);
        const again = loginWith({ spellStyles: { "readyCooldown:Cultivation": { color: RED } }, areUtilityLooksMoved: true });
        const kept = again.getSavedSettings()!.spellStyles as Record<string, unknown>;
        expect(kept["readyCooldown:Cultivation"] !== undefined).toBe(true);
    });
});
