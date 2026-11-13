// The shaman's totems by the Cooldown Manager: its buff icon of a totem holds the player's totem while it stands, in a fight
// too, so a slot whose every totem has an icon is read from them; any other is guessed from the casts, as before.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    playAs,
    SHAMAN,
    targetEnemy,
    type ClientState,
    type SpellDefinition,
    type World,
} from "@wowkit/test-kit";

const totem = (id: number, name: string): SpellDefinition => ({ id, name, rank: 1, icon: 136000, isHelpful: true });
const SEARING = totem(3599, "Searing Totem");
const STRENGTH_OF_EARTH = totem(8075, "Strength of Earth Totem");
const STONESKIN = totem(8071, "Stoneskin Totem");
const MANA_SPRING = totem(5675, "Mana Spring Totem");
const EARTH_SLOT = 2;

type TrackedBuff = ClientState["trackedBuffs"][number];

/** A shaman with four totems on buttons 1 to 4 (fire, earth, earth, water), these with an icon in Tracked Buffs, in a fight. */
function createFight(withIcons: SpellDefinition[]): World {
    const world = createWorld((state) => {
        playAs(state, SHAMAN);
        for (const spell of [SEARING, STRENGTH_OF_EARTH, STONESKIN, MANA_SPRING]) learnSpell(state, spell);
        [SEARING, STRENGTH_OF_EARTH, STONESKIN, MANA_SPRING].forEach((spell, index) => (state.bars[index + 1] = spell.id));
        state.totemSpells = { 1: [SEARING.id], 2: [STRENGTH_OF_EARTH.id, STONESKIN.id], 3: [MANA_SPRING.id], 4: [] };
        for (const spell of withIcons) state.trackedBuffs.push({ spellId: spell.id, isActive: false, isTotem: true });
        targetEnemy(state);
    });
    world.advance(1);
    world.state.isInCombat = true;
    world.state.areTotemsHidden = true;
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(1);
    return world;
}

const findIcon = (world: World, spell: SpellDefinition): TrackedBuff => world.state.trackedBuffs.find((buff) => buff.spellId === spell.id)!;

/** The game says the earth slot changed; a cast of the player's comes first when given. */
function changeEarthSlot(world: World, cast?: SpellDefinition): void {
    if (cast !== undefined) world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", cast.id);
    world.fire("PLAYER_TOTEM_UPDATE", EARTH_SLOT);
    world.advance(0.5);
}

const readGlows = (world: World) => [1, 2, 3, 4].map((button) => world.glowsOn(button)).join("");

describe("a shaman's totems in a fight, by the Cooldown Manager's icons", () => {
    it("quiet a slot whose totem's icon holds it, with no cast of it seen", () => {
        const world = createFight([STRENGTH_OF_EARTH, STONESKIN]);
        findIcon(world, STRENGTH_OF_EARTH).isActive = true;
        changeEarthSlot(world);
        expect(readGlows(world)).toBe("1001");
    });

    it("light it again once the icon lets go, though the change came right after a cast of a totem", () => {
        const world = createFight([STRENGTH_OF_EARTH, STONESKIN]);
        findIcon(world, STRENGTH_OF_EARTH).isActive = true;
        changeEarthSlot(world, STRENGTH_OF_EARTH);
        expect(readGlows(world)).toBe("1001");
        // Killed at once: the guess from the cast would keep the slot taken
        findIcon(world, STRENGTH_OF_EARTH).isActive = false;
        changeEarthSlot(world, STRENGTH_OF_EARTH);
        expect(readGlows(world)).toBe("1111");
    });

    it("do not count another shaman's totem: its icon shows the aura, holding no totem", () => {
        const world = createFight([STRENGTH_OF_EARTH, STONESKIN]);
        const icon = findIcon(world, STRENGTH_OF_EARTH);
        icon.isTotem = false;
        icon.isActive = true;
        changeEarthSlot(world);
        expect(readGlows(world)).toBe("1111");
    });

    it("guess from the casts in a slot with a totem no icon tracks", () => {
        const world = createFight([STRENGTH_OF_EARTH]);
        changeEarthSlot(world, STONESKIN);
        expect(readGlows(world)).toBe("1001");
    });

    it("guess from the casts when the addon may not use the Cooldown Manager", () => {
        const world = createFight([STRENGTH_OF_EARTH, STONESKIN]);
        world.setOption("cooldownManagerAccess", "off");
        changeEarthSlot(world, STRENGTH_OF_EARTH);
        expect(readGlows(world)).toBe("1001");
    });
});

describe("a shaman's totems in the Cooldown Manager's saved layout", () => {
    it("are put in Tracked Buffs with the buffs", () => {
        const world = createWorld((state) => {
            playAs(state, SHAMAN);
            learnSpell(state, STRENGTH_OF_EARTH);
            state.totemSpells = { 2: [STRENGTH_OF_EARTH.id] };
            state.buffCatalog.push({ spellId: STRENGTH_OF_EARTH.id, isHiddenByDefault: true });
        });
        world.advance(6);
        expect(world.state.viewerSaves).toBe(1);
    });
});
