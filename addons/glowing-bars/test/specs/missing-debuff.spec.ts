// A debuff the player added by its ID (issue #86): with a living enemy targeted, in a fight by default, its button glows while
// the enemy lacks the player's own debuff. In a fight the game hides the target's debuffs, so a cast at the enemy is taken to
// put it on for as long as it lasts: learned from its aura where the game shows it, else Serpent Sting 15 seconds, Hunter's
// Mark 2 minutes. Each enemy keeps its own; one that dies loses them. Where the game shows the debuffs, they are the truth.
import {
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
import { findAddRowOf, switchInTable, toggleTable } from "./table.helpers";

const SERPENT_STING: SpellDefinition = { id: 1978, name: "Serpent Sting", rank: 1, icon: 132204, isHarmful: true, maxRange: 35 };
const HUNTERS_MARK: SpellDefinition = { id: 1130, name: "Hunter's Mark", rank: 1, icon: 132212, isHarmful: true, maxRange: 100 };
const ADDED = [
    { id: SERPENT_STING.id, reminderType: "missingDebuff" },
    { id: HUNTERS_MARK.id, reminderType: "missingDebuff" },
];

/** The game of a fight on Forever: the target's debuffs are kept from addon code, and C_Secrets says so. */
function hideDebuffs(state: ClientState): void {
    const secrecy = state.auraSecrecy;
    secrecy.isHiding = true;
    secrecy.hidesDebuffs = true;
    secrecy.hiddenSpells[SERPENT_STING.id] = true;
    secrecy.hiddenSpells[HUNTERS_MARK.id] = true;
    secrecy.saysRestricted = true;
    secrecy.saysSecretOthers = true;
}

/** A hunter with Serpent Sting on button 1 and Hunter's Mark on button 2, both added; in a fight with an enemy whose debuffs are hidden, unless said. */
function createHunter(saved: Record<string, unknown> = {}, isHidden = true): World {
    const world = createWorld(
        (state) => {
            playAs(state, HUNTER);
            learnSpell(state, SERPENT_STING);
            learnSpell(state, HUNTERS_MARK);
            state.bars[1] = SERPENT_STING.id;
            state.bars[2] = HUNTERS_MARK.id;
            state.isInCombat = true;
            if (isHidden) hideDebuffs(state);
            targetEnemy(state);
        },
        { addedSpells: ADDED, ...saved },
    );
    world.advance(1);
    return world;
}

function cast(world: World, spell: SpellDefinition): void {
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", `cast-${spell.id}`, spell.id);
    world.advance(0.5);
}

function changeTarget(world: World, name: string): void {
    targetEnemy(world.state, { name });
    world.fire("PLAYER_TARGET_CHANGED");
    world.advance(0.5);
}

describe("a debuff the player added, in a fight where the game hides the target's debuffs", () => {
    it("glows while the enemy targeted has not had it cast on", () => {
        const world = createHunter();
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("glows with no living enemy targeted, nor out of a fight (its default When)", () => {
        const world = createHunter();
        world.state.target = undefined;
        world.fire("PLAYER_TARGET_CHANGED");
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        targetEnemy(world.state, { isEnemy: false });
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        targetEnemy(world.state);
        world.state.isInCombat = false;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("stops glowing at a cast, and glows again once its 15 seconds are over", () => {
        const world = createHunter();
        cast(world, SERPENT_STING);
        expect(world.glowsOn(1)).toBe(0);
        expect(world.glowsOn(2)).toBe(1);
        world.advance(13);
        expect(world.glowsOn(1)).toBe(0);
        world.advance(2);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("trusts the cast while the game leaves the debuffs out of the list, though C_Secrets says none is secret", () => {
        const world = createHunter();
        world.state.auraSecrecy.saysRestricted = false;
        cast(world, SERPENT_STING);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("takes Hunter's Mark to last 2 minutes", () => {
        const world = createHunter();
        cast(world, HUNTERS_MARK);
        world.advance(100);
        expect(world.glowsOn(2)).toBe(0);
        world.advance(21);
        expect(world.glowsOn(2)).toBe(1);
    });

    it("keeps each enemy's debuff apart: another enemy lacks it, the first one targeted again still has it", () => {
        const world = createHunter();
        cast(world, SERPENT_STING);
        changeTarget(world, "Defias Pillager");
        expect(world.glowsOn(1)).toBe(1);
        changeTarget(world, "Defias Thug");
        expect(world.glowsOn(1)).toBe(0);
    });

    it("forgets an enemy's debuff once it dies", () => {
        const world = createHunter();
        cast(world, SERPENT_STING);
        world.state.target!.isDead = true;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        // The same enemy back on its feet (as a test can have it) shows the debuff was forgotten
        world.state.target!.isDead = false;
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("asks for it as early as its Before says", () => {
        const world = createHunter({ styles: { missingDebuff: { before: 3 } } });
        cast(world, SERPENT_STING);
        world.advance(11);
        expect(world.glowsOn(1)).toBe(0);
        world.advance(1.5);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("glows no more once the type is switched off in the table", () => {
        const world = createHunter();
        switchInTable(world, "Missing debuff", false);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("says so in the message when its look has one", () => {
        const world = createHunter({ styles: { missingDebuff: { isMessageOn: true } } });
        world.advance(1);
        expect(world.notice()).toContain("Missing debuff");
    });
});

describe("a debuff the player added, where the game shows the target's debuffs", () => {
    /** The hunter out of a fight, the debuffs glowing whenever an enemy is targeted. */
    function createAtPeace(): World {
        const world = createHunter({ styles: { missingDebuff: { when: "always" } } }, false);
        world.state.isInCombat = false;
        world.advance(1);
        return world;
    }

    it("goes by the player's own aura on the enemy, by its ID or its name", () => {
        const world = createAtPeace();
        expect(world.glowsOn(1)).toBe(1);
        world.state.target!.debuffs = [world.makeAura(SERPENT_STING.name, SERPENT_STING.id, 10, "player")];
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
        // Another rank, of another ID: its name is the same
        world.state.target!.debuffs = [world.makeAura(SERPENT_STING.name, 13549, 10, "player")];
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("does not count another player's debuff", () => {
        const world = createAtPeace();
        world.state.target!.debuffs = [world.makeAura(SERPENT_STING.name, SERPENT_STING.id, 10, "raid1")];
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
    });

    it("trusts the aura over a cast: a cast whose debuff did not land glows again", () => {
        const world = createHunter({}, false);
        world.state.target!.debuffs = [world.makeAura(HUNTERS_MARK.name, HUNTERS_MARK.id, 100, "player")];
        cast(world, SERPENT_STING);
        world.advance(1);
        expect(world.glowsOn(1)).toBe(1);
        expect(world.glowsOn(2)).toBe(0);
    });

    it("learns how long the debuff lasts from its aura, and follows that in a fight where it is hidden", () => {
        const world = createAtPeace();
        world.state.target!.debuffs = [world.makeAura(SERPENT_STING.name, SERPENT_STING.id, 30, "player")];
        world.advance(1);
        expect(Object.values(world.getSavedSettings()?.debuffDurations as Record<string, number>)).toEqual([30]);
        world.state.target!.debuffs = [];
        hideDebuffs(world.state);
        world.state.isInCombat = true;
        world.fire("PLAYER_REGEN_DISABLED");
        changeTarget(world, "Defias Pillager");
        cast(world, SERPENT_STING);
        // The 15 seconds of the list would be over
        world.advance(20);
        expect(world.glowsOn(1)).toBe(0);
        world.advance(10);
        expect(world.glowsOn(1)).toBe(1);
    });
});

describe("the table's add row", () => {
    it("adds a debuff by its Spell ID on the Buffs tab", () => {
        const world = createWorld((state) => {
            playAs(state, HUNTER);
            learnSpell(state, SERPENT_STING);
        });
        world.advance(1);
        toggleTable();
        const { box, reminderType, add } = findAddRowOf(world, "Buffs");
        world.pickFromMenu(reminderType, "Missing debuff");
        box.text = string.format("%d", SERPENT_STING.id);
        add.scripts.OnClick!(add);
        expect(world.getSavedSettings()?.addedSpells).toEqual([{ id: SERPENT_STING.id, reminderType: "missingDebuff" }]);
    });
});
