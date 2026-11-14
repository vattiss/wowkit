// Cultivation, the tauren's second herb (issue #57): a utility cooldown, of between fights. It glows anywhere, once as it is
// ready; its type's When (Utility cooldown) moves it as it moves every utility cooldown, and what the player sets on its row
// wins over that. The Ready cooldown type's When leaves it alone.
import { createWorld, describe, expect, it, learnSpell, playAs, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";

const CULTIVATION: SpellDefinition = { id: 20552, name: "Cultivation", rank: 1, icon: 136099, cooldownSeconds: 900 };
const WHENS = ["always", "inCombat", "inCombatStart", "outOfCombat"] as const;

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

describe("Cultivation, a utility cooldown", () => {
    it("glows once when ready, for the glow time, and not again as a fight starts", () => {
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

    it("goes by its row's When, else the Utility cooldown type's, and never by the Ready cooldown type's", () => {
        const wrong: string[] = [];
        for (const typeWhen of ["default", ...WHENS]) {
            for (const rowWhen of ["default", ...WHENS]) {
                const world = createTauren({
                    styles: {
                        ...(typeWhen !== "default" ? { utilityCooldown: { when: typeWhen } } : {}),
                        readyCooldown: { when: "inCombat" },
                    },
                    spellStyles: rowWhen !== "default" ? { "utilityCooldown:Cultivation": { when: rowWhen } } : {},
                });
                const peace = world.glowsOn(1);
                startFight(world);
                const fight = world.glowsOn(1);
                // Its own row, else its type, else Always. In a fight a ready one glows as it starts only with In combat + start,
                // or still within its glow time where it may glow in a fight
                const when = rowWhen !== "default" ? rowWhen : typeWhen !== "default" ? typeWhen : "always";
                const isInCombatOnly = when === "inCombat" || when === "inCombatStart";
                const want = `${isInCombatOnly ? 0 : 1}${when !== "outOfCombat" && when !== "inCombat" ? 1 : 0}`;
                const got = `${peace}${fight}`;
                if (got !== want) wrong.push(`type ${typeWhen}, row ${rowWhen}: ${got}, want ${want}`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });
});
