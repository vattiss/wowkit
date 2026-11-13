// The buffs each paladin keeps one of (issue #68), by combination: each kind of blessing or aura from each kind of caster,
// against the rule. The same buff, or its Greater version, counts from anyone, as they do not stack; another of its group
// only the player's own, as different paladins' stack.
import {
    createWorld,
    describe,
    expect,
    it,
    learnSpell,
    PALADIN,
    playAs,
    POWER,
    type FakeAura,
    type SpellDefinition,
} from "@wowkit/test-kit";

const spell = (id: number, name: string): SpellDefinition => ({ id, name, rank: 1, icon: 1, isHelpful: true });
const MIGHT = spell(19740, "Blessing of Might");
const KINGS = spell(20217, "Blessing of Kings");
const GREATER_MIGHT = spell(25782, "Greater Blessing of Might");
const GREATER_KINGS = spell(25898, "Greater Blessing of Kings");
const DEVOTION = spell(465, "Devotion Aura");
const RETRIBUTION = spell(7294, "Retribution Aura");
const CASTERS = ["player", "other", "unnamed"] as const;
type Caster = (typeof CASTERS)[number];

/** A buff on someone, and whether it is the wanted one (or its Greater version) or another of its group. */
interface Put {
    spell: SpellDefinition;
    isSame: boolean;
    caster: Caster;
}

function toAura(put: Put): FakeAura {
    const sourceUnit = put.caster === "player" ? "player" : put.caster === "other" ? "party1" : undefined;
    return { name: put.spell.name, spellId: put.spell.id, expirationTime: 0, sourceUnit };
}

/** The rule: up when one is the same buff from anyone, or another of its group the player cast. */
const isCounted = (puts: Put[]) => puts.some((put) => put.isSame || put.caster === "player");

const describePut = (put: Put) => `${put.spell.name} by ${put.caster}`;

/** Every buff of the group from every caster: for Might, Might and Greater Might are the same, Kings and Greater Kings other. */
function listPuts(same: SpellDefinition[], other: SpellDefinition[]): Put[] {
    const puts: Put[] = [];
    for (const caster of CASTERS) {
        for (const buff of same) puts.push({ spell: buff, isSame: true, caster });
        for (const buff of other) puts.push({ spell: buff, isSame: false, caster });
    }
    return puts;
}

/** Does the paladin's button of `wanted` glow, with these buffs on them, out of combat or in a fight? */
function readPlayerGlow(wanted: SpellDefinition, puts: Put[], isFight: boolean): number {
    const world = createWorld((state) => {
        playAs(state, PALADIN);
        for (const known of [MIGHT, KINGS, GREATER_MIGHT, GREATER_KINGS, DEVOTION, RETRIBUTION]) state.spells[known.id] ??= known;
        learnSpell(state, wanted);
        state.bars[1] = wanted.id;
        for (const put of puts) state.auras.push(toAura(put));
    });
    world.advance(1);
    if (isFight) {
        world.state.isInCombat = true;
        world.state.areAurasHidden = true;
        world.fire("PLAYER_REGEN_DISABLED");
        world.advance(1);
    }
    return world.glowsOn(1);
}

describe("the buffs each paladin keeps one of, by combination", () => {
    it("of each blessing from each caster, for Might and Kings, out of combat and in a fight", () => {
        const wrong: string[] = [];
        const groups = [
            { wanted: MIGHT, puts: listPuts([MIGHT, GREATER_MIGHT], [KINGS, GREATER_KINGS]) },
            { wanted: KINGS, puts: listPuts([KINGS, GREATER_KINGS], [MIGHT, GREATER_MIGHT]) },
        ];
        for (const { wanted, puts } of groups) {
            for (const isFight of [false, true]) {
                for (const onPlayer of [[], ...puts.map((put) => [put])]) {
                    const want = isCounted(onPlayer) ? 0 : 1;
                    const got = readPlayerGlow(wanted, onPlayer, isFight);
                    const what = onPlayer.map((put) => describePut(put)).join(", ");
                    if (got !== want) wrong.push(`${wanted.name}, ${isFight ? "fight" : "peace"}, ${what || "none"}: ${got}, want ${want}`);
                }
            }
        }
        expect(`${wrong.length} wrong: ${wrong.slice(0, 6).join(" | ")}`).toBe("0 wrong: ");
    });

    it("of every two blessings together, for Might", () => {
        const wrong: string[] = [];
        const puts = listPuts([MIGHT, GREATER_MIGHT], [KINGS, GREATER_KINGS]);
        for (const first of puts) {
            for (const second of puts) {
                // The same buff twice is one buff: the game keeps one
                if (first.spell === second.spell) continue;
                const want = isCounted([first, second]) ? 0 : 1;
                const got = readPlayerGlow(MIGHT, [first, second], false);
                if (got !== want) wrong.push(`${describePut(first)} + ${describePut(second)}: ${got}, want ${want}`);
            }
        }
        expect(`${wrong.length} wrong: ${wrong.slice(0, 6).join(" | ")}`).toBe("0 wrong: ");
    });

    it("of each aura from each caster, out of combat and in a fight", () => {
        const wrong: string[] = [];
        for (const [wanted, other] of [
            [RETRIBUTION, DEVOTION],
            [DEVOTION, RETRIBUTION],
        ] as const) {
            const puts = listPuts([wanted], [other]);
            for (const isFight of [false, true]) {
                for (const onPlayer of [[], ...puts.map((put) => [put])]) {
                    const want = isCounted(onPlayer) ? 0 : 1;
                    const got = readPlayerGlow(wanted, onPlayer, isFight);
                    const what = onPlayer.map((put) => describePut(put)).join(", ");
                    if (got !== want) wrong.push(`${wanted.name}, ${isFight ? "fight" : "peace"}, ${what || "none"}: ${got}, want ${want}`);
                }
            }
        }
        expect(`${wrong.length} wrong: ${wrong.join(" | ")}`).toBe("0 wrong: ");
    });

    it("of Kings, Greater Kings and Might on a party member, each from any caster or none, the player giving Kings", () => {
        const kinds = [
            { spell: KINGS, isSame: true },
            { spell: GREATER_KINGS, isSame: true },
            { spell: MIGHT, isSame: false },
        ];
        const wrong: string[] = [];
        for (let combo = 0; combo < 64; combo++) {
            // Each kind: absent, or by one of the three casters (four ways each)
            const puts: Put[] = [];
            kinds.forEach((kind, index) => {
                const way = math.floor(combo / 4 ** index) % 4;
                if (way > 0) puts.push({ ...kind, caster: CASTERS[way - 1]! });
            });
            const world = createWorld(
                (state) => {
                    playAs(state, PALADIN);
                    for (const known of [MIGHT, GREATER_KINGS]) state.spells[known.id] ??= known;
                    learnSpell(state, KINGS);
                    state.auras.push({ name: KINGS.name, spellId: KINGS.id, expirationTime: 1300 });
                    state.party = [{ name: "Tank", classToken: "WARRIOR", power: POWER.Rage, auras: puts.map((put) => toAura(put)) }];
                },
                { styles: { missingBuff: { isMessageOn: true } } },
            );
            world.advance(1);
            const isNamed = world.notice().includes("Tank");
            if (isNamed === isCounted(puts))
                wrong.push(`${puts.map((put) => describePut(put)).join(", ") || "none"}: named ${tostring(isNamed)}`);
        }
        expect(`${wrong.length} wrong: ${wrong.slice(0, 6).join(" | ")}`).toBe("0 wrong: ");
    });
});
