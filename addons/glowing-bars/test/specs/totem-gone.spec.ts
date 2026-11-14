// The shaman's totems that are gone (issue #48): a totem the player dropped is killed or runs out, and the totem dropped last
// in its element glows, for its glow time (3 seconds by default). Nothing glows before a drop, and Totemic Recall is no loss.
import { createWorld, describe, expect, it, learnSpell, playAs, SHAMAN, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";
import { toggleTable } from "./table.helpers";

const totem = (id: number, name: string): SpellDefinition => ({ id, name, rank: 1, icon: 100000 + id, isHelpful: true });
const SEARING = totem(3599, "Searing Totem");
const MAGMA = totem(8190, "Magma Totem");
const STRENGTH_OF_EARTH = totem(8075, "Strength of Earth Totem");
const MANA_SPRING = totem(5675, "Mana Spring Totem");
const RECALL = totem(36936, "Totemic Recall");
const CALL = totem(66842, "Call of the Elements");
/** The action slot of the totem bar's first button (MultiCastActionButton1). */
const TOTEM_BAR_SLOT = 133;

/** A shaman with Searing, Magma, Strength of Earth and Mana Spring on buttons 1 to 4. */
function createShaman(saved?: Record<string, unknown>, change?: (world: World) => void): World {
    const world = createWorld((state) => {
        playAs(state, SHAMAN);
        for (const spell of [SEARING, MAGMA, STRENGTH_OF_EARTH, MANA_SPRING, RECALL, CALL]) learnSpell(state, spell);
        [SEARING, MAGMA, STRENGTH_OF_EARTH, MANA_SPRING].forEach((spell, index) => (state.bars[index + 1] = spell.id));
        state.totemSpells = { 1: [SEARING.id, MAGMA.id], 2: [STRENGTH_OF_EARTH.id], 3: [MANA_SPRING.id], 4: [] };
    }, saved);
    change?.(world);
    world.advance(1);
    return world;
}

/** The player drops a totem in its slot: the cast, then the slot changes, and the totem stands. */
function drop(world: World, spell: SpellDefinition, slot: number): void {
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", spell.id);
    world.state.totems[slot] = { name: spell.name, start: GetTime(), duration: 120 };
    world.fire("PLAYER_TOTEM_UPDATE", slot);
    world.advance(1.5);
}

/** The totem in the slot is killed or runs out: the slot changes with no cast, told at a tick once a cast could not follow. */
function lose(world: World, slot: number): void {
    world.state.totems[slot] = undefined;
    world.fire("PLAYER_TOTEM_UPDATE", slot);
    world.advance(2.2);
}

const readGlows = (world: World) => [1, 2, 3, 4].map((button) => world.glowsOn(button)).join("");

describe("a shaman's totem that is gone", () => {
    it("lights nothing before a totem was dropped, nor while it stands", () => {
        const world = createShaman();
        expect(readGlows(world)).toBe("0000");
        drop(world, SEARING, 1);
        expect(readGlows(world)).toBe("0000");
    });

    it("lights the totem dropped last in its element once it is gone, for its glow time", () => {
        const world = createShaman();
        drop(world, SEARING, 1);
        lose(world, 1);
        expect(readGlows(world)).toBe("1000");
        world.advance(3);
        expect(readGlows(world)).toBe("0000");
    });

    it("lights the new one when another totem of the element took its place", () => {
        const world = createShaman();
        drop(world, SEARING, 1);
        drop(world, MAGMA, 1);
        expect(readGlows(world)).toBe("0000");
        lose(world, 1);
        expect(readGlows(world)).toBe("0100");
    });

    it("works the same in a fight, while the game hides the slots", () => {
        const world = createShaman();
        world.state.isInCombat = true;
        world.state.areTotemsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
        drop(world, STRENGTH_OF_EARTH, 2);
        expect(readGlows(world)).toBe("0000");
        lose(world, 2);
        expect(readGlows(world)).toBe("0010");
    });

    it("tells a totem gone in a fight by Blizzard's totem frame, though the game hides which spell was cast", () => {
        const world = createShaman({ styles: { totemGone: { glowTime: 0 } } });
        drop(world, SEARING, 1);
        lose(world, 1);
        world.state.isInCombat = true;
        world.state.areTotemsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        // Dropped again with no spell to read: the frame shows it standing, and the glow goes
        world.state.totems[1] = { name: SEARING.name, start: GetTime(), duration: 120 };
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", undefined);
        world.fire("PLAYER_TOTEM_UPDATE", 1);
        world.advance(1.5);
        expect(readGlows(world)).toBe("0000");
        lose(world, 1);
        expect(readGlows(world)).toBe("1000");
    });

    it("changes nothing in a fight without Blizzard's totem frame (an addon took it away): nothing can tell", () => {
        const world = createShaman();
        world.state.hasTotemFrame = false;
        world.state.isInCombat = true;
        world.state.areTotemsHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        drop(world, SEARING, 1);
        lose(world, 1);
        expect(readGlows(world)).toBe("0000");
    });

    it("glows until it is dropped again with Until done", () => {
        const world = createShaman({ styles: { totemGone: { glowTime: 0 } } });
        drop(world, MANA_SPRING, 3);
        lose(world, 3);
        world.advance(10);
        expect(readGlows(world)).toBe("0001");
        drop(world, MANA_SPRING, 3);
        expect(readGlows(world)).toBe("0000");
    });

    it("takes Totemic Recall for no totem gone", () => {
        const world = createShaman();
        drop(world, SEARING, 1);
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", RECALL.id);
        lose(world, 1);
        expect(readGlows(world)).toBe("0000");
    });

    it("leaves out an element switched off in its row", () => {
        const world = createShaman({ enabledSpells: { "-9001": false } });
        drop(world, SEARING, 1);
        lose(world, 1);
        expect(readGlows(world)).toBe("0000");
    });

    it("knows the last totem of an element after a reload, a totem of it standing", () => {
        const world = createShaman({ lastTotems: { "1": SEARING.id } }, (w) => {
            w.state.totems[1] = { name: SEARING.name, start: GetTime(), duration: 120 };
        });
        lose(world, 1);
        expect(readGlows(world)).toBe("1000");
    });

    it("follows the totems a call of the totem bar drops, one in each slot", () => {
        const world = createShaman(undefined, (w) => {
            w.state.bars[TOTEM_BAR_SLOT] = SEARING.id;
            w.state.bars[TOTEM_BAR_SLOT + 1] = STRENGTH_OF_EARTH.id;
        });
        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", CALL.id);
        for (const slot of [1, 2]) world.fire("PLAYER_TOTEM_UPDATE", slot);
        world.state.totems[1] = { name: SEARING.name, start: GetTime(), duration: 120 };
        world.state.totems[2] = { name: STRENGTH_OF_EARTH.name, start: GetTime(), duration: 120 };
        world.advance(1.5);
        lose(world, 2);
        expect(readGlows(world)).toBe("0010");
    });
});

describe("the totems gone in the table", () => {
    it("has a row of their type and one for each element, in the order of the slots, for a shaman alone", () => {
        const world = createShaman();
        toggleTable();
        // The rows in the order they were drawn: the frames are made as the table goes down
        const labels = ["Totem gone", "Fire", "Earth", "Water", "Air"];
        const shown = world.frames
            .filter((frame) => frame.isShown && frame.fontStrings.some((line) => line.text === "Fire" || line.text === "Totem gone"))
            .flatMap((frame) =>
                frame.fontStrings.filter((line) => line.isShown && labels.includes(line.text ?? "")).map((line) => line.text),
            );
        expect(shown.filter((text, index) => shown.indexOf(text) === index).join(", ")).toBe("Totem gone, Fire, Earth, Water, Air");
        const warrior = createWorld((state) => playAs(state, WARRIOR));
        warrior.advance(1);
        toggleTable();
        expect(warrior.frames.some((frame) => frame.fontStrings.some((line) => line.text === "Totem gone" && line.isShown))).toBe(false);
    });
});
