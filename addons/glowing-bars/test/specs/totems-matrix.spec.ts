// The shaman's totems by combination: the slots, a totem switched off, the When, where they are, and the events of a
// fight in every order, each against what should glow by the rule: a totem glows while no totem stands in its slot, when
// it is switched on, when its When holds, and on the totem bar alone if the player asked for that.
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
/** One totem of each slot, on buttons 1 to 4 (fire, earth, water, air). */
const TOTEMS = [
    totem(3599, "Searing Totem"),
    totem(8075, "Strength of Earth Totem"),
    totem(5675, "Mana Spring Totem"),
    totem(8512, "Windfury Totem"),
];
const CALL = totem(66842, "Call of the Elements");
const TOTEM_BAR_SLOT = 133;
const WHENS = ["always", "inCombat", "outOfCombat", "enemyTargeted"] as const;

function createShaman(change?: (state: ClientState) => void, saved?: Record<string, unknown>): World {
    const world = createWorld((state) => {
        playAs(state, SHAMAN);
        for (const spell of [...TOTEMS, CALL]) learnSpell(state, spell);
        TOTEMS.forEach((spell, index) => {
            state.bars[index + 1] = spell.id;
            state.totemSpells[index + 1] = [spell.id];
        });
        targetEnemy(state);
        change?.(state);
    }, saved);
    world.advance(1);
    return world;
}

const readGlows = (world: World) => [1, 2, 3, 4].map((button) => world.glowsOn(button)).join("");

describe("a shaman's totems by every combination", () => {
    it("of slots taken, and a totem switched off", () => {
        const wrong: string[] = [];
        // Every way the four slots are taken, all totems on; and one totem off (earth) beside a taken slot (fire): a
        // switch is the totem's own, so one case of it says it
        const cases: { taken: number; off: number }[] = [{ taken: 1, off: 2 }];
        for (let taken = 0; taken < 16; taken++) cases.push({ taken, off: 0 });
        for (const { taken, off } of cases) {
            const isTaken = (slot: number) => math.floor(taken / 2 ** (slot - 1)) % 2 === 1;
            const isOff = (slot: number) => math.floor(off / 2 ** (slot - 1)) % 2 === 1;
            const enabledSpells: Record<string, boolean> = {};
            TOTEMS.forEach((spell, index) => {
                if (isOff(index + 1)) enabledSpells[tostring(spell.id)] = false;
            });
            const world = createShaman(
                (state) => {
                    TOTEMS.forEach((spell, index) => {
                        if (isTaken(index + 1)) state.totems[index + 1] = { name: spell.name, start: 0, duration: 120 };
                    });
                },
                { enabledSpells },
            );
            const want = [1, 2, 3, 4].map((slot) => (!isTaken(slot) && !isOff(slot) ? 1 : 0)).join("");
            const got = readGlows(world);
            if (got !== want) wrong.push(`taken ${taken}, off ${off}: ${got}, want ${want}`);
        }
        expect(`${wrong.length} wrong: ${wrong.slice(0, 6).join(" | ")}`).toBe("0 wrong: ");
    });

    it("of When, a fight and a target", () => {
        const wrong: string[] = [];
        for (const when of WHENS) {
            for (const isFight of [false, true]) {
                for (const hasTarget of [false, true]) {
                    const world = createShaman(
                        (state) => {
                            if (!hasTarget) state.target = undefined;
                        },
                        { styles: { missingTotem: { when } } },
                    );
                    if (isFight) {
                        world.state.isInCombat = true;
                        world.fire("PLAYER_REGEN_DISABLED");
                        world.advance(1);
                    }
                    const holds = when === "always" || (when === "inCombat" ? isFight : when === "outOfCombat" ? !isFight : hasTarget);
                    const want = holds ? "1111" : "0000";
                    const got = readGlows(world);
                    if (got !== want)
                        wrong.push(`${when}, fight ${tostring(isFight)}, target ${tostring(hasTarget)}: ${got}, want ${want}`);
                }
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("of where a totem is and the totem bar alone", () => {
        const wrong: string[] = [];
        for (const isOnlyTotemBar of [false, true]) {
            for (const place of ["action bar", "totem bar", "both"] as const) {
                const world = createShaman(
                    (state) => {
                        if (place !== "action bar") state.bars[TOTEM_BAR_SLOT] = TOTEMS[0]!.id;
                        if (place === "totem bar") state.bars[1] = undefined;
                    },
                    { shouldGlowTotemsOnlyOnTotemBar: isOnlyTotemBar },
                );
                const onActionBar = place !== "totem bar" && !isOnlyTotemBar ? 1 : 0;
                const onTotemBar = place !== "action bar" ? 1 : 0;
                const want = `${onActionBar}${onTotemBar}`;
                const got = `${world.glowsOn(1)}${world.glowsOnFrame("MultiCastActionButton1")}`;
                if (got !== want) wrong.push(`only totem bar ${tostring(isOnlyTotemBar)}, ${place}: ${got}, want ${want}`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("of the events of a fight in every order of two", () => {
        type Step = { kind: "drop" | "gone"; slot: number } | { kind: "call" };
        const steps: Step[] = [{ kind: "call" }];
        for (const slot of [1, 2, 3, 4]) steps.push({ kind: "drop", slot }, { kind: "gone", slot });
        const describeStep = (step: Step) => (step.kind === "call" ? "call" : `${step.kind} ${step.slot}`);
        const wrong: string[] = [];
        for (const first of steps) {
            for (const second of steps) {
                const world = createShaman();
                world.state.isInCombat = true;
                world.state.areTotemsHidden = true;
                world.fire("PLAYER_REGEN_DISABLED");
                world.advance(1);
                const isTaken = [false, false, false, false, false];
                for (const step of [first, second]) {
                    if (step.kind === "call") {
                        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", CALL.id);
                        for (const slot of [1, 2, 3, 4]) world.fire("PLAYER_TOTEM_UPDATE", slot);
                        for (const slot of [1, 2, 3, 4]) isTaken[slot] = true;
                    } else if (step.kind === "drop") {
                        world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", TOTEMS[step.slot - 1]!.id);
                        world.fire("PLAYER_TOTEM_UPDATE", step.slot);
                        isTaken[step.slot] = true;
                    } else {
                        world.fire("PLAYER_TOTEM_UPDATE", step.slot);
                        isTaken[step.slot] = false;
                    }
                    // Apart from each other: a change this late is no longer of the cast before it
                    world.advance(2);
                }
                const want = [1, 2, 3, 4].map((slot) => (isTaken[slot] ? 0 : 1)).join("");
                const got = readGlows(world);
                if (got !== want) wrong.push(`${[first, second].map((step) => describeStep(step)).join(", ")}: ${got}, want ${want}`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.slice(0, 6).join(" | ")}`).toBe("0 wrong: ");
    });
});
