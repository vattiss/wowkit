// What the text of a macro casts, and which macro a button holds: every shape a macro can have.
import {
    createWorld,
    describe,
    expect,
    INNER_FIRE,
    it,
    learnSpell,
    playAs,
    PRIEST,
    ROGUE,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

interface TestMacro {
    body: string;
    name?: string;
    spellId?: number;
    isShowingItem?: boolean;
}

const OTHER_SPELL: SpellDefinition = { id: 586, name: "Fade", rank: 1, icon: 1, isHelpful: true };

function createWithMacros(macros: { [slot: number]: TestMacro }): World {
    const world = createWorld((state) => {
        playAs(state, PRIEST);
        learnSpell(state, INNER_FIRE);
        learnSpell(state, OTHER_SPELL);
        state.barMacros = macros;
    });
    world.advance(3);
    return world;
}

function isLit(body: string): boolean {
    return createWithMacros({ 2: { body } }).glowsOn(2) > 0;
}

describe("the lines of a macro that cast", () => {
    for (const body of [
        "/cast Inner Fire",
        "/use Inner Fire",
        "/CAST Inner Fire",
        "  /cast Inner Fire",
        "#show Inner Fire",
        "#showtooltip Inner Fire",
        "#showtooltip [mod] Inner Fire; Fade",
        "/cast Inner Fire(Rank 1)",
        "/cast [mod:shift] Fade; Inner Fire",
        "/cast [@mouseover,help,nodead][] !Inner Fire",
        "/use [combat] Inner Fire",
        "/castrandom Fade, Inner Fire",
        "/userandom Inner Fire",
        "/castsequence Inner Fire",
        "/castsequence Fade, Inner Fire",
        "/castsequence reset=30 Inner Fire, Fade",
        "/castsequence reset=target/combat Inner Fire",
        "/castsequence [combat] reset=target/combat Inner Fire",
        "/castsequence [mod] reset=5 Fade; reset=10 Inner Fire",
        "/stopcasting\n/cast Inner Fire",
        "/target boss1\n/cast Inner Fire\n/targetlasttarget",
        "/cancelform\r\n/cast [nomounted] Inner Fire",
    ]) {
        it(`counts "${body}" as casting the spell`, () => {
            expect(isLit(body)).toBe(true);
        });
    }
});

describe("the lines of a macro that do not cast", () => {
    for (const body of [
        "/target Inner Fire",
        "/say Inner Fire",
        "/cancelaura Inner Fire",
        "/equip Inner Fire",
        "/click ActionButton1",
        "/run CastSpellByName('Inner Fire')",
        "-- /cast Inner Fire",
        "#SHOWTOOLTIP Inner Fire",
        "#showtooltip",
        "/cast",
        "/cast [mod]",
        "/castsequence reset=30",
        "/use 0 1",
        "/use 13",
    ]) {
        it(`does not count "${body}" as casting it`, () => {
            expect(isLit(body)).toBe(false);
        });
    }

    it("does not split a /cast at a comma: that is part of a name", () => {
        expect(isLit("/cast Fade, Inner Fire")).toBe(false);
    });
});

describe("the commands of the client's own language", () => {
    function createWithCommand(name: "SLASH_CAST1" | "SLASH_CASTSEQUENCE1", word: string, body: string): number {
        const globals = _G as unknown as { [key: string]: string | undefined };
        globals[name] = word;
        const glows = createWithMacros({ 2: { body } }).glowsOn(2);
        globals[name] = undefined;
        return glows;
    }

    it("understands its cast command", () => {
        expect(createWithCommand("SLASH_CAST1", "/zaubern", "/zaubern Inner Fire")).toBe(1);
    });

    it("splits its list command at the commas", () => {
        expect(createWithCommand("SLASH_CASTSEQUENCE1", "/zauberfolge", "/zauberfolge reset=5 Fade, Inner Fire")).toBe(1);
    });
});

describe("a name in brackets", () => {
    const WARD: SpellDefinition = { id: 999200, name: "Ward (Bear)", rank: 1, icon: 1, isHelpful: true };

    it("is kept when it is part of the name of the spell", () => {
        const world = createWorld(
            (state) => {
                playAs(state, PRIEST);
                learnSpell(state, WARD);
                state.barMacros[2] = { body: "/cast Ward (Bear)" };
            },
            { addedSpells: [{ id: WARD.id, reminderType: "missingBuff" }] },
        );
        world.advance(3);
        expect(world.glowsOn(2)).toBe(1);
    });
});

describe("the switch of the glow on macros", () => {
    it("keeps macro buttons dark when switched off, and the spell's own button still glows", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.bars[1] = INNER_FIRE.id;
            state.barMacros = { 2: { body: "/cast Inner Fire" } };
        });
        world.advance(3);
        expect(world.glowsOn(2)).toBe(1);
        world.setOption("shouldGlowOnMacros", false);
        world.advance(1);
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("the icon of a macro", () => {
    it("does not make a /target macro an Inner Fire button, even with Inner Fire's icon", () => {
        const world = createWorld((state) => {
            playAs(state, PRIEST);
            learnSpell(state, INNER_FIRE);
            state.barMacros = { 2: { body: "/target Kentw", icon: INNER_FIRE.icon } };
        });
        world.advance(3);
        expect(world.glowsOn(2)).toBe(0);
    });
});

describe("a macro that is edited", () => {
    it("is read again: a cast line turned into /target no longer glows", () => {
        const world = createWithMacros({ 2: { body: "/cast Inner Fire" } });
        expect(world.glowsOn(2)).toBe(1);
        world.state.barMacros[2]!.body = "/target Kent";
        world.fire("UPDATE_MACROS");
        world.advance(3);
        expect(world.glowsOn(2)).toBe(0);
    });
});

describe("which macro a button holds", () => {
    it("goes by the game's number when macros share a blank name", () => {
        const world = createWithMacros({
            2: { body: "/target Kent", name: " " },
            5: { body: "/cast Inner Fire", name: " " },
        });
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(5)).toBe(1);
    });

    it("goes by the game's number when macros share a name", () => {
        const world = createWithMacros({
            2: { body: "/target Kent", name: "same" },
            5: { body: "/cast Inner Fire", name: "same" },
        });
        expect(world.glowsOn(2)).toBe(0);
        expect(world.glowsOn(5)).toBe(1);
    });

    it("reads a macro that shows an item by its name, the game's number being another's", () => {
        const world = createWithMacros({
            4: { body: "/target Kent", name: "first" },
            5: { body: "/cast Inner Fire", name: "shows item", isShowingItem: true },
        });
        expect(world.glowsOn(5)).toBe(1);
    });

    it("reads a macro that shows an item by its blank name when it is the only macro with that name", () => {
        const world = createWithMacros({ 5: { body: "/cast Inner Fire", name: " ", isShowingItem: true } });
        expect(world.glowsOn(5)).toBe(1);
    });

    it("reads nothing for a macro that shows an item when its name cannot tell: a blank one", () => {
        const world = createWithMacros({
            4: { body: "/cast Inner Fire", name: " " },
            5: { body: "/use Hearthstone", name: " ", isShowingItem: true },
        });
        expect(world.glowsOn(4)).toBe(1);
        expect(world.glowsOn(5)).toBe(0);
    });

    it("reads nothing for a macro that shows an item when another macro has its name", () => {
        const world = createWithMacros({
            4: { body: "/cast Inner Fire", name: "same" },
            5: { body: "/use Hearthstone", name: "same", isShowingItem: true },
        });
        expect(world.glowsOn(5)).toBe(0);
    });

    it("reads the other lines of a macro showing a spell now, by its name", () => {
        const world = createWithMacros({ 2: { body: "/cast [mod] Inner Fire; Fade", name: "two", spellId: OTHER_SPELL.id } });
        expect(world.glowsOn(2)).toBe(1);
    });

    it("reads the other lines of a macro showing a spell by its blank name when it is the only one with it", () => {
        const world = createWithMacros({ 2: { body: "/cast [mod] Inner Fire; Fade", name: " ", spellId: OTHER_SPELL.id } });
        expect(world.glowsOn(2)).toBe(1);
    });

    it("reads the other lines of a macro showing a spell among others of its blank name: the one showing that spell", () => {
        const world = createWithMacros({
            2: { body: "/cast [mod] Inner Fire; Fade", name: " ", spellId: OTHER_SPELL.id },
            4: { body: "/target Kent", name: " " },
            5: { body: "/say hello", name: " " },
        });
        expect(world.glowsOn(2)).toBe(1);
    });

    it("cannot tell which macro it is when two of the same blank name show the same spell", () => {
        const world = createWithMacros({
            2: { body: "/cast [mod] Inner Fire; Fade", name: " ", spellId: OTHER_SPELL.id },
            4: { body: "/cast Fade", name: " ", spellId: OTHER_SPELL.id },
        });
        expect(world.glowsOn(2)).toBe(0);
    });
});

describe("the weapon a macro is for", () => {
    const MAIN_HAND = 16;
    const OFF_HAND = 17;

    function createWithLine(useLine: string): World {
        const world = createWorld((state) => {
            playAs(state, ROGUE);
            state.spells[8679] = { id: 8679, name: "Instant Poison", rank: 1, icon: 132273, isHelpful: true };
            state.spells[8686] = { id: 8686, name: "Instant Poison II", rank: 1, icon: 132273, isHelpful: true };
            state.itemUseSpells[6949] = 8686;
            state.itemIds["Instant Poison II"] = 6949;
            state.bags[6949] = 5;
            state.barMacros[1] = { body: `#showtooltip\n/use Instant Poison II\n${useLine}` };
            state.equippedItems[MAIN_HAND] = 1234;
            state.equippedItems[OFF_HAND] = 5678;
            // The off-hand has its poison, the main hand has none
            state.enchants[OFF_HAND] = { enchantID: 323, remainingTimeMs: 3600000 };
        });
        world.advance(5);
        return world;
    }

    it("stays dark while the weapon of a plain /use has its poison", () => {
        expect(createWithLine("/use 17").glowsOn(1)).toBe(0);
    });

    it("stays dark the same with conditions on the /use", () => {
        expect(createWithLine("/use [nomod] 17").glowsOn(1)).toBe(0);
    });

    it("lights for the other weapon", () => {
        expect(createWithLine("/use [nomod] 16").glowsOn(1)).toBe(1);
    });
});
