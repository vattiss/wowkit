// An offensive racial at the front of the list: a night elf hunter's Elune's Light.
import {
    beforeEach,
    createWorld,
    describe,
    expect,
    HUNTER,
    it,
    learnSpell,
    playAs,
    targetEnemy,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const ELUNES_LIGHT: SpellDefinition = { id: 1259799, name: "Elune's Light", rank: 1, icon: 1259799, isHelpful: true };
const HUNTERS_MARK: SpellDefinition = { id: 1130, name: "Hunter's Mark", rank: 1, icon: 1130, maxRange: 100, isHarmful: true };

/** A night elf hunter with Elune's Light on button 1 and Hunter's Mark on 2, fighting an enemy at 20 yards. */
function setUpNightElf(state: ClientState): void {
    playAs(state, HUNTER);
    state.race = { id: 4, file: "NightElf" };
    for (const spell of [ELUNES_LIGHT, HUNTERS_MARK]) learnSpell(state, spell);
    state.bars[1] = ELUNES_LIGHT.id;
    state.bars[2] = HUNTERS_MARK.id;
    targetEnemy(state, { yards: 20 });
    state.isInCombat = true;
}

describe("a night elf hunter in a fight", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld(setUpNightElf);
        world.advance(1);
    });

    /** The hunter puts Hunter's Mark on the target. */
    function castMark(): void {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", HUNTERS_MARK.id);
        world.state.target!.debuffs.push(world.makeAura(HUNTERS_MARK.name, HUNTERS_MARK.id, 120, "player"));
    }

    it("lights Hunter's Mark first: it reaches farther than the racial", () => {
        world.advance(0.5);
        expect(world.glowsOn(2)).toBe(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes on with Elune's Light once the mark is on, steadily, also while the target moves around 28 yards", () => {
        castMark();
        for (let tick = 0; tick < 10; tick++) {
            world.state.target!.yards = tick % 2 === 0 ? 27 : 30;
            world.advance(0.2);
            expect(world.glowsOn(1)).toBe(1);
            expect(world.glowsOn(2)).toBe(0);
        }
    });

    it("waits with Elune's Light at the pull until the target is near", () => {
        world.state.isInCombat = false;
        world.state.target!.yards = 35;
        castMark();
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(0);
        world.state.target!.yards = 20;
        world.advance(0.5);
        expect(world.glowsOn(1)).toBe(1);
    });
});
