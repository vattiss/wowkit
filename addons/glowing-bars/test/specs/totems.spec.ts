// The shaman's totems (issue #48): a totem glows while no totem stands in its slot, from an enemy targeted on by default.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    SHAMAN,
    targetEnemy,
    WARRIOR,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";
import { toggleTable } from "./table.helpers";

const totem = (id: number, name: string): SpellDefinition => ({ id, name, rank: 1, icon: 136000, isHelpful: true });
const SEARING = totem(3599, "Searing Totem");
const STRENGTH_OF_EARTH = totem(8075, "Strength of Earth Totem");
const STONESKIN = totem(8071, "Stoneskin Totem");
const MANA_SPRING = totem(5675, "Mana Spring Totem");
const CALL_OF_THE_ELEMENTS = totem(66842, "Call of the Elements");
/** The action slot of the totem bar's first button (MultiCastActionButton1). */
const TOTEM_BAR_SLOT = 133;

/** A shaman with four totems on buttons 1 to 4 (fire, earth, earth, water), as the game lists them by slot. */
function createShaman(change?: (state: ClientState) => void, saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, SHAMAN);
        for (const spell of [SEARING, STRENGTH_OF_EARTH, STONESKIN, MANA_SPRING, CALL_OF_THE_ELEMENTS]) learnSpell(state, spell);
        [SEARING, STRENGTH_OF_EARTH, STONESKIN, MANA_SPRING].forEach((spell, index) => (state.bars[index + 1] = spell.id));
        state.totemSpells = { 1: [SEARING.id], 2: [STRENGTH_OF_EARTH.id, STONESKIN.id], 3: [MANA_SPRING.id], 4: [] };
        targetEnemy(state);
        change?.(state);
    }, saved);
    world.advance(1);
    return world;
}

const readGlows = (world: World) => [1, 2, 3, 4].map((button) => world.glowsOn(button)).join("");

describe("a shaman's totems", () => {
    it("glow, each while no totem stands in its slot, with an enemy targeted", () => {
        expect(readGlows(createShaman())).toBe("1111");
    });

    it("go quiet for a whole slot once a totem of it stands, and only for that slot", () => {
        const world = createShaman((state) => (state.totems[2] = { name: STRENGTH_OF_EARTH.name, start: 0, duration: 120 }));
        expect(readGlows(world)).toBe("1001");
    });

    it("do not glow with no enemy targeted: that is their When by default", () => {
        expect(readGlows(createShaman((state) => (state.target = undefined)))).toBe("0000");
    });

    it("leave out a totem switched off in the table", () => {
        expect(readGlows(createShaman(undefined, { enabledSpells: { [tostring(STONESKIN.id)]: false } }))).toBe("1101");
    });

    it("still glow by the addon's own list when the game names no totems of a slot", () => {
        expect(readGlows(createShaman((state) => (state.totemSpells = {})))).toBe("1111");
    });

    it("glow on the totem bar alone when the player asks for it", () => {
        const world = createShaman((state) => (state.bars[TOTEM_BAR_SLOT] = SEARING.id), { shouldGlowTotemsOnlyOnTotemBar: true });
        expect(world.glowsOnFrame("MultiCastActionButton1")).toBe(1);
        expect(readGlows(world)).toBe("0000");
    });

    it("do not show for another class", () => {
        const world = createWorld((state) => {
            playAs(state, WARRIOR);
            targetEnemy(state);
        });
        world.advance(1);
        toggleTable();
        expect(world.frames.some((frame) => frame.fontStrings.some((line) => line.text === "Missing totem"))).toBe(false);
    });

    it("are listed in the table under the heading of their element, in slot order", () => {
        const world = createShaman();
        toggleTable();
        // The headings are drawn on the table's content; a row's Type column says Missing totem too
        const content = world.frames.find((frame) => frame.fontStrings.some((line) => line.text === "Fire"))!;
        const headings = content.fontStrings
            .filter((line) => line.isShown && ["Missing totem", "Fire", "Earth", "Water", "Air"].includes(line.text ?? ""))
            .map((line) => line.text);
        expect(headings.join(", ")).toBe("Missing totem, Fire, Earth, Water");
    });
});

describe("a shaman's totems in a fight, while the game hides the slots", () => {
    function startFight(world: World): void {
        world.state.isInCombat = true;
        world.state.areTotemsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
    }

    function cast(world: World, spell: SpellDefinition, slots: number[]): void {
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", spell.id);
        for (const slot of slots) world.fire("PLAYER_TOTEM_UPDATE", slot);
        world.advance(0.5);
    }

    it("quiet a slot once a totem is dropped in it, and light it again once it is gone", () => {
        const world = createShaman();
        startFight(world);
        cast(world, STRENGTH_OF_EARTH, [2]);
        expect(readGlows(world)).toBe("1001");
        world.advance(5);
        world.fire("PLAYER_TOTEM_UPDATE", 2);
        world.advance(0.5);
        expect(readGlows(world)).toBe("1111");
    });

    it("fill every slot a call of four changes", () => {
        const world = createShaman();
        startFight(world);
        cast(world, CALL_OF_THE_ELEMENTS, [1, 2, 3, 4]);
        expect(readGlows(world)).toBe("0000");
    });
});

describe("the totems' switch of where they glow", () => {
    it("is on the settings page of a shaman only", () => {
        const shaman = createShaman();
        shaman.openOptions();
        expect(shaman.hasOption("shouldGlowTotemsOnlyOnTotemBar")).toBe(true);
        const warrior = createWorld((state) => playAs(state, WARRIOR));
        warrior.advance(1);
        warrior.openOptions();
        expect(warrior.hasOption("shouldGlowTotemsOnlyOnTotemBar")).toBe(false);
    });
});
