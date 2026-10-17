import {
    beforeEach,
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    PRIEST,
    SMITE_RANK_1,
    SMITE_RANK_2,
    type ClientState,
    type World,
} from "@wowkit/test-kit";

/** A priest who knows Smite rank 2 and has rank 1 on the first button. */
function setUpPriest(state: ClientState, isResting: boolean): void {
    playAs(state, PRIEST);
    for (const spell of [SMITE_RANK_1, SMITE_RANK_2]) learnSpell(state, spell);
    state.bars[1] = SMITE_RANK_1.id;
    state.isResting = isResting;
}

describe("a priest with Smite rank 1 on the bar, who knows rank 2", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => setUpPriest(state, false));
        world.advance(3);
    });

    it("is told about both ranks", () => {
        expect(world.notice()).toContain("Smite: Rank 1 is on your action bar, but you know Rank 2.");
    });

    it("is told nothing any more once the bar holds the best rank", () => {
        world.state.bars[1] = SMITE_RANK_2.id;
        world.fire("ACTIONBAR_SLOT_CHANGED", 1);
        // The message that is on the screen goes out by itself after 10 seconds
        world.advance(15);
        expect(world.notice()).toBe("");
    });

    it("is told nothing when the player muted the addon", () => {
        world = createWorld((state) => setUpPriest(state, false));
        world.setOption("isMuted", true);
        // The first message went out at login; it is not repeated when muted
        world.advance(45);
        expect(world.notice()).toBe("");
    });

    it("keeps its settings in the character's saved variables", () => {
        expect(world.getSavedSettings()?.hideResting).toBe(true);
    });
});

describe("a priest resting in a town", () => {
    it("is told nothing by default", () => {
        const world = createWorld((state) => setUpPriest(state, true));
        world.advance(3);
        expect(world.notice()).toBe("");
    });

    it("is told when the player switched the quiet mode off", () => {
        const world = createWorld((state) => setUpPriest(state, true));
        world.setOption("hideResting", false);
        world.advance(3);
        expect(world.notice()).toContain("Smite: Rank 1");
    });
});

describe("the sound of the message", () => {
    it("is the alarm clock 1 unless the player picked another", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        world.advance(3);
        expect(world.sounds).toEqual([18871]);
    });

    it("is not played when the player picked none", () => {
        const world = createWorld((state) => setUpPriest(state, true));
        world.setOption("hideResting", false);
        world.setOption("sound", "none");
        world.advance(3);
        expect(world.sounds.length).toBe(0);
    });

    it("is played each time the message appears", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        // the message at login played the default
        expect(world.sounds.length).toBe(1);
        world.setOption("sound", "raidwarning");
        // choosing a sound plays it once as a preview
        expect(world.sounds.length).toBe(2);
        // the same message is shown again after 30 seconds
        world.advance(35);
        expect(world.sounds).toEqual([18871, 8959, 8959]);
    });
});

describe("a character whose saved sound has gone from the list", () => {
    it("gets the default sound again", () => {
        const world = createWorld((state) => setUpPriest(state, false), { sound: "ping" });
        world.advance(3);
        expect(world.getSavedSettings()?.sound).toBe("alarm1");
        expect(world.sounds).toEqual([18871]);
    });

    it("keeps a saved sound that is still in the list", () => {
        const world = createWorld((state) => setUpPriest(state, false), { sound: "raidwarning" });
        world.advance(3);
        expect(world.getSavedSettings()?.sound).toBe("raidwarning");
        expect(world.sounds).toEqual([8959]);
    });
});
