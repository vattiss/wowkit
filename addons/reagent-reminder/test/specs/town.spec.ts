import {
    beforeEach,
    createWorld,
    describe,
    expect,
    FORTITUDE,
    HOLY_CANDLE,
    it,
    learnSpell,
    playAs,
    PRAYER_OF_FORTITUDE,
    PRIEST,
    type ClientState,
    type World,
} from "@wowkit/test-kit";

/** A priest who knows Prayer of Fortitude, which costs a Holy Candle, and has none in the bags. */
function setUpPriest(state: ClientState, isResting: boolean): void {
    playAs(state, PRIEST);
    learnSpell(state, FORTITUDE);
    learnSpell(state, PRAYER_OF_FORTITUDE);
    state.reagentTexts[PRAYER_OF_FORTITUDE.id] = "Holy Candle";
    state.bags[HOLY_CANDLE] = 0;
    state.isResting = isResting;
}

describe("a priest who arrives in a town", () => {
    let world!: World;

    beforeEach(() => {
        world = createWorld((state) => setUpPriest(state, true));
    });

    it("is told which reagents run low", () => {
        expect(world.chat.join("\n")).toContain("Reagents running low: Holy Candle (0)");
    });

    it("sees the message on the screen too", () => {
        expect(world.notice()).toContain("Reagents running low: Holy Candle (0)");
    });

    it("is told nothing when the player muted the addon", () => {
        world = createWorld((state) => setUpPriest(state, false));
        world.setOption("isMuted", true);
        world.state.isResting = true;
        world.fire("PLAYER_UPDATE_RESTING");
        expect(world.chat.join("\n")).not.toContain("Reagents running low");
    });

    it("keeps its settings in the character's saved variables", () => {
        expect(world.getSavedSettings()?.isMuted).toBe(false);
    });
});

describe("a priest who is not in a town", () => {
    it("is told nothing", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        expect(world.chat.join("\n")).not.toContain("Reagents running low");
    });

    it("is told nothing when the candles are in the bags", () => {
        const world = createWorld((state) => {
            setUpPriest(state, true);
            state.bags[HOLY_CANDLE] = 20;
        });
        expect(world.chat.join("\n")).not.toContain("Reagents running low");
    });
});

describe("the sound of the message", () => {
    it("is not played unless the player picked one", () => {
        const world = createWorld((state) => setUpPriest(state, true));
        expect(world.sounds.length).toBe(0);
    });

    it("is played when the message appears", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        world.setOption("sound", "ping");
        // choosing a sound plays it once as a preview
        expect(world.sounds.length).toBe(1);
        world.state.isResting = true;
        world.fire("PLAYER_UPDATE_RESTING");
        expect(world.sounds.length).toBe(2);
    });
});

describe("the reagents of a priest on the options page", () => {
    function arriveInTown(world: World): void {
        world.state.isResting = true;
        world.fire("PLAYER_UPDATE_RESTING");
    }

    it("have a switch each, and none for another class's reagents", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        expect(world.proxySettings["ReagentReminder_reagent_17028"]).toBeDefined();
        expect(world.proxySettings["ReagentReminder_reagent_17029"]).toBeDefined();
        expect(world.proxySettings["ReagentReminder_reagent_17021"]).toBeUndefined();
    });

    it("silence the message of a reagent that is switched off", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        world.setOption("reagent_17028", false);
        arriveInTown(world);
        expect(world.chat.join("\n")).not.toContain("Reagents running low");
    });

    it("are stored only where they differ from the default", () => {
        const world = createWorld((state) => setUpPriest(state, false));
        world.setOption("reagent_17028", false);
        const reagentOn = world.getSavedSettings()?.reagentOn as Record<string, boolean | undefined>;
        expect(reagentOn["17028"]).toBe(false);
        world.setOption("reagent_17028", true);
        const afterwards = world.getSavedSettings()?.reagentOn as Record<string, boolean | undefined>;
        expect(afterwards["17028"]).toBeUndefined();
    });
});
