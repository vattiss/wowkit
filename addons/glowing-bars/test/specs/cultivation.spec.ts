// Cultivation, the tauren's second herb (issue #57): a ready cooldown used while gathering, so out of combat by its own
// default look. What the player sets on its row wins; the Ready cooldown type's When does not move it, as with Shield Block.
import { createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";

const CULTIVATION: SpellDefinition = { id: 20552, name: "Cultivation", rank: 1, icon: 136099, cooldownSeconds: 900 };
const WHENS = ["always", "inCombat", "outOfCombat"] as const;

function createTauren(saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, WARRIOR);
        learnSpell(state, CULTIVATION);
        state.bars[1] = CULTIVATION.id;
    }, saved);
    world.advance(1);
    return world;
}

function startFight(world: World): void {
    world.state.isInCombat = true;
    world.fire("PLAYER_REGEN_DISABLED");
    world.advance(0.5);
}

describe("Cultivation, a racial used out of combat", () => {
    it("glows out of combat when ready, for the glow time, and not in a fight", () => {
        const world = createTauren();
        expect(world.glowsOn(1)).toBe(1);
        world.advance(3);
        expect(world.glowsOn(1)).toBe(0);
        startFight(world);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("does not glow while on its cooldown", () => {
        const world = createTauren();
        world.state.cooldowns[CULTIVATION.id] = { start: 0, duration: 99999 };
        world.advance(1);
        expect(world.glowsOn(1)).toBe(0);
    });

    it("goes by the When of its own row, whatever the Ready cooldown type's When is", () => {
        const wrong: string[] = [];
        for (const typeWhen of ["default", ...WHENS]) {
            for (const rowWhen of ["default", ...WHENS]) {
                const world = createTauren({
                    styles: typeWhen !== "default" ? { readyCooldown: { when: typeWhen } } : {},
                    spellStyles: rowWhen !== "default" ? { "readyCooldown:Cultivation": { when: rowWhen } } : {},
                });
                const peace = world.glowsOn(1);
                startFight(world);
                const fight = world.glowsOn(1);
                // Its own row, else its default: Out of combat. In a fight a ready one glows as it starts (on by default)
                const when = rowWhen !== "default" ? rowWhen : "outOfCombat";
                const want = `${when !== "inCombat" ? 1 : 0}${when !== "outOfCombat" ? 1 : 0}`;
                const got = `${peace}${fight}`;
                if (got !== want) wrong.push(`type ${typeWhen}, row ${rowWhen}: ${got}, want ${want}`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });
});
