// Mark of the Wild at every rank and from every caster, with Blizzard's icon following each rank, against what the addon may
// know: an icon takes an aura only by its entry's exact IDs, and only the player's own (issue #67).
import { createWorld, describe, DRUID, expect, it, learnSpell, playAs, type SpellDefinition, type World } from "@wowkit/test-kit";

const RANKS: SpellDefinition[] = [
    { id: 1126, name: "Mark of the Wild", rank: 1, icon: 136078, isHelpful: true },
    { id: 5232, name: "Mark of the Wild", rank: 2, icon: 136078, isHelpful: true },
    { id: 6756, name: "Mark of the Wild", rank: 3, icon: 136078, isHelpful: true },
];
const CASTERS = ["player", "other", "unnamed"] as const;
type Caster = (typeof CASTERS)[number];

interface Case {
    /** The rank on the player; undefined: none. */
    rank?: SpellDefinition;
    caster: Caster;
    /** The rank the icon follows. */
    follows: SpellDefinition;
}

function listCases(): Case[] {
    const cases: Case[] = [];
    for (const follows of RANKS) {
        cases.push({ caster: "player", follows });
        for (const rank of RANKS) for (const caster of CASTERS) cases.push({ rank, caster, follows });
    }
    return cases;
}

function describeCase(c: Case): string {
    return `${c.rank !== undefined ? `rank ${c.rank.rank} by ${c.caster}` : "none"}, icon of rank ${c.follows.rank}`;
}

/** A druid who knows the three ranks, the newest on button 1, with Blizzard's icon of `follows` in Tracked Buffs. */
function createDruid(c: Case): World {
    const world = createWorld((state) => {
        playAs(state, DRUID);
        for (const rank of RANKS) learnSpell(state, rank);
        state.bars[1] = RANKS[2]!.id;
        state.trackedBuffs.push({ spellId: c.follows.id, isActive: false });
    });
    putOn(world, c);
    return world;
}

/** The buff on the player, and the icon as Blizzard's would be: active for the player's own of exactly its rank. */
function putOn(world: World, c: Case): void {
    if (c.rank === undefined) return;
    const sourceUnit = c.caster === "player" ? "player" : c.caster === "other" ? "party1" : undefined;
    world.state.auras.push(world.makeAura(c.rank.name, c.rank.id, 1800, sourceUnit));
    world.state.trackedBuffs[0]!.isActive = c.caster === "player" && c.rank.id === c.follows.id;
}

function takeOff(world: World): void {
    world.state.auras = [];
    world.state.trackedBuffs[0]!.isActive = false;
}

function startFight(world: World): void {
    world.state.isInCombat = true;
    world.state.areAurasHidden = true;
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(2);
}

describe("Mark of the Wild at any rank, from any caster, with the icon of any rank", () => {
    it("glows only when it is not on, in peace and in a fight", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            const world = createDruid(c);
            world.advance(2);
            const peace = world.glowsOn(1);
            startFight(world);
            const fight = world.glowsOn(1);
            const want = c.rank === undefined ? 1 : 0;
            if (peace !== want || fight !== want) wrong.push(`${describeCase(c)}: ${peace}${fight}, want ${want}${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("glows once taken off in a fight only where its own icon can tell: the player's, of the rank it follows", () => {
        const wrong: string[] = [];
        for (const c of listCases()) {
            if (c.rank === undefined) continue;
            const world = createDruid(c);
            world.advance(2);
            startFight(world);
            takeOff(world);
            world.advance(2);
            // Another's, or another rank: no icon has a say, and the memory holds it until the fight is over
            const want = c.caster === "player" && c.rank.id === c.follows.id ? 1 : 0;
            const got = world.glowsOn(1);
            if (got !== want) wrong.push(`${describeCase(c)}: ${got}, want ${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("stops glowing once the player casts any rank in a fight", () => {
        const wrong: string[] = [];
        for (const follows of RANKS) {
            for (const rank of RANKS) {
                const c: Case = { caster: "player", follows };
                const world = createDruid(c);
                world.advance(2);
                startFight(world);
                const before = world.glowsOn(1);
                world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast-1", rank.id);
                putOn(world, { ...c, rank });
                world.advance(2);
                const after = world.glowsOn(1);
                if (before !== 1 || after !== 0)
                    wrong.push(`cast rank ${rank.rank}, icon of rank ${follows.rank}: ${before}${after}, want 10`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });
});
