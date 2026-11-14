// The low reagents of the lists had a row for each reagent; each spell that takes one now has its own. What the player set
// for a reagent's row (its switch, its limit, its look) moves once to the rows of all its spells, at the login.
import { createWorld, describe, expect, it, playAs, PRIEST, type World } from "@wowkit/test-kit";

const SACRED_CANDLE = 17029;
const RED = [1, 0, 0];

function loginWith(saved: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        state.spells[21564] = { id: 21564, name: "Prayer of Fortitude", rank: 2, icon: 135941 };
        state.spells[27681] = { id: 27681, name: "Prayer of Spirit", rank: 1, icon: 135946 };
        state.spells[27683] = { id: 27683, name: "Prayer of Shadow Protection", rank: 1, icon: 136121 };
    }, saved);
    world.advance(1);
    return world;
}

describe("what a reagent's row had, split among the rows of its spells", () => {
    it("moves its switch, limit and look to each spell that takes the reagent, once", () => {
        const world = loginWith({
            enabledReagents: { [`${SACRED_CANDLE}`]: false },
            belowLimits: { [`lowReagent:${SACRED_CANDLE}`]: 5 },
            spellStyles: { "lowReagent:Prayer of Fortitude": { color: RED } },
        });
        const saved = world.getSavedSettings()!;
        const enabled = saved.enabledSpells as Record<string, boolean | undefined>;
        const limits = saved.belowLimits as Record<string, number | undefined>;
        const looks = saved.spellStyles as Record<string, { color?: number[] } | undefined>;
        for (const id of [21564, 27681, 27683]) {
            expect(enabled[`${id}`]).toBe(false);
            expect(limits[`lowReagent:spell${id}`]).toBe(5);
        }
        expect(limits[`lowReagent:${SACRED_CANDLE}`]).toBe(undefined);
        expect(looks["lowReagent:Prayer of Spirit"]?.color?.join(",")).toBe("1,0,0");
        expect(looks["lowReagent:Prayer of Shadow Protection"]?.color?.join(",")).toBe("1,0,0");
        expect(saved.areReagentRowsSplit).toBe(true);
    });

    it("leaves what the rows of the spells have alone, and moves nothing a second time", () => {
        const world = loginWith({
            belowLimits: { [`lowReagent:${SACRED_CANDLE}`]: 5, "lowReagent:spell27681": 12 },
        });
        const limits = world.getSavedSettings()!.belowLimits as Record<string, number | undefined>;
        expect(limits["lowReagent:spell27681"]).toBe(12);
        const again = loginWith({ belowLimits: { [`lowReagent:${SACRED_CANDLE}`]: 5 }, areReagentRowsSplit: true });
        const kept = again.getSavedSettings()!.belowLimits as Record<string, number | undefined>;
        expect(kept[`lowReagent:${SACRED_CANDLE}`]).toBe(5);
        expect(kept["lowReagent:spell27681"]).toBe(undefined);
    });
});
