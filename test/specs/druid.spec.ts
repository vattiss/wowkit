import { beforeEach, describe, expect, it } from "../framework";
import { learnSpell, playAs } from "../world/client-state";
import { createWorld, type World } from "../world/world";
import { DRUID, MARK_OF_THE_WILD, THORNS } from "./fixtures";

describe("a druid with two missing buffs", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, DRUID);
            learnSpell(state, MARK_OF_THE_WILD);
            learnSpell(state, THORNS);
            state.bars[1] = MARK_OF_THE_WILD.id;
            state.bars[2] = THORNS.id;
        });
    });

    it("sees both buttons glow at once", () => {
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("sees only the other button glow after casting one", () => {
        world.state.auras.push(world.makeAura(MARK_OF_THE_WILD.name, MARK_OF_THE_WILD.id, 1800));
        world.fire("UNIT_AURA", "player");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
    });
});
