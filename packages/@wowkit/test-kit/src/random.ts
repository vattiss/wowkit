// A seeded random number source for tests that try many cases: the same seed gives the same cases, so a failure found by
// one can be played again. Park and Miller's generator: its products stay below 2^47, exact in Lua's numbers.

const MODULUS = 2147483647;
const MULTIPLIER = 48271;

export interface Random {
    /** A whole number from 0 up to, not including, `count`. */
    pickIndex(count: number): number;
    /** True with this chance (0 to 1). */
    isChance(chance: number): boolean;
    /** One of these. */
    pickOne<T>(choices: readonly T[]): T;
}

export function createRandom(seed: number): Random {
    let value = (Math.floor(seed) % (MODULUS - 1)) + 1;
    const next = (): number => {
        value = (value * MULTIPLIER) % MODULUS;
        return value / MODULUS;
    };
    return {
        pickIndex: (count) => Math.floor(next() * count),
        isChance: (chance) => next() < chance,
        pickOne: (choices) => choices[Math.floor(next() * choices.length)]!,
    };
}
