// A small describe / it / expect in the style of Jest. The tests are TypeScript compiled to Lua and
// run by LuaJIT (scripts/smoke-test.ts). Every `it` starts from a fresh world, built in a beforeEach.

// The fake game replaces print (it records the addon's chat output); the report keeps the real one
const report = print;

interface TestCase {
    kind: "test";
    name: string;
    run: () => void;
}

interface Suite {
    kind: "suite";
    name: string;
    depth: number;
    parent: Suite | undefined;
    entries: (Suite | TestCase)[];
    hooks: (() => void)[];
}

const root: Suite = { kind: "suite", name: "", depth: -1, parent: undefined, entries: [], hooks: [] };
let current = root;

export function describe(name: string, body: () => void): void {
    const suite: Suite = { kind: "suite", name, depth: current.depth + 1, parent: current, entries: [], hooks: [] };
    current.entries.push(suite);
    const outer = current;
    current = suite;
    body();
    current = outer;
}

export function it(name: string, run: () => void): void {
    current.entries.push({ kind: "test", name, run });
}

/** Runs before every test of this describe block and of the ones inside it. */
export function beforeEach(hook: () => void): void {
    current.hooks.push(hook);
}

// ---------------------------------------------------------------------------------------------
// Expectations

export interface Matchers<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    /** A string contains the text, or a list contains the item. */
    toContain(expected: unknown): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeTruthy(): void;
    toBeGreaterThan(expected: number): void;
    readonly not: Matchers<T>;
}

function format(value: unknown): string {
    if (type(value) === "string") return `"${value as string}"`;
    if (type(value) !== "table") return tostring(value);
    const parts: string[] = [];
    for (const [key, item] of pairs(value as object)) parts.push(`${tostring(key)}: ${format(item)}`);
    return `{ ${parts.join(", ")} }`;
}

function areEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (type(a) !== "table" || type(b) !== "table") return false;
    for (const [key, item] of pairs(a as object)) {
        if (!areEqual(item, (b as Record<string, unknown>)[key as string])) return false;
    }
    for (const [key] of pairs(b as object)) {
        if ((a as Record<string, unknown>)[key as string] === undefined) return false;
    }
    return true;
}

function doesContain(actual: unknown, expected: unknown): boolean {
    if (type(actual) === "string") return string.find(actual as string, tostring(expected), 1, true)[0] !== undefined;
    if (type(actual) !== "table") return false;
    for (const [, item] of pairs(actual as object)) {
        if (areEqual(item, expected)) return true;
    }
    return false;
}

function assertThat(isPass: boolean, isNegated: boolean, describeFailure: (isNegated: boolean) => string): void {
    if (isPass === isNegated) throw new Error(describeFailure(isNegated));
}

function buildMatchers<T>(actual: T, isNegated: boolean): Matchers<T> {
    const not = isNegated ? "not " : "";
    return {
        toBe(expected: T) {
            assertThat(actual === expected, isNegated, () => `expected ${format(actual)} ${not}to be ${format(expected)}`);
        },
        toEqual(expected: unknown) {
            assertThat(areEqual(actual, expected), isNegated, () => `expected ${format(actual)} ${not}to equal ${format(expected)}`);
        },
        toContain(expected: unknown) {
            assertThat(doesContain(actual, expected), isNegated, () => `expected ${format(actual)} ${not}to contain ${format(expected)}`);
        },
        toBeUndefined() {
            assertThat(actual === undefined, isNegated, () => `expected ${format(actual)} ${not}to be undefined`);
        },
        toBeDefined() {
            assertThat(actual !== undefined, isNegated, () => `expected ${format(actual)} ${not}to be defined`);
        },
        toBeTruthy() {
            assertThat(actual !== undefined && (actual as unknown) !== false, isNegated, () => `expected ${format(actual)} ${not}to be truthy`);
        },
        toBeGreaterThan(expected: number) {
            assertThat((actual as unknown as number) > expected, isNegated, () => `expected ${format(actual)} ${not}to be greater than ${expected}`);
        },
        // Filled in by createMatchers, which builds the positive and the negated set together
        not: undefined as unknown as Matchers<T>,
    };
}

/** The matchers and their negation (`expect(x).not`), pointing at each other. */
function createMatchers<T>(actual: T): Matchers<T> {
    const positive = buildMatchers(actual, false);
    const negated = buildMatchers(actual, true);
    (positive as { not: Matchers<T> }).not = negated;
    (negated as { not: Matchers<T> }).not = positive;
    return positive;
}

export function expect<T>(actual: T): Matchers<T> {
    return createMatchers(actual);
}

// ---------------------------------------------------------------------------------------------
// Running

interface Tally {
    passed: number;
    failed: number;
}

function describeError(error: unknown): string {
    if (type(error) === "table" && (error as { message?: string }).message !== undefined) return (error as { message: string }).message;
    return tostring(error);
}

/** The hooks of this suite and the ones around it, outermost first. */
function collectHooks(suite: Suite): (() => void)[] {
    const hooks = suite.parent ? collectHooks(suite.parent) : [];
    hooks.push(...suite.hooks);
    return hooks;
}

function indent(depth: number): string {
    return string.rep("  ", depth + 1);
}

function runTest(test: TestCase, suite: Suite, tally: Tally): void {
    const hooks = collectHooks(suite);
    const [didSucceed, error] = pcall(() => {
        for (const hook of hooks) hook();
        test.run();
    });
    if (didSucceed) {
        tally.passed += 1;
        report(`${indent(suite.depth)}ok   ${test.name}`);
    } else {
        tally.failed += 1;
        report(`${indent(suite.depth)}FAIL ${test.name}`);
        report(`${indent(suite.depth)}     ${describeError(error)}`);
    }
}

function runSuite(suite: Suite, tally: Tally): void {
    if (suite !== root) report(`${string.rep("  ", suite.depth)}${suite.name}`);
    for (const entry of suite.entries) {
        if (entry.kind === "suite") runSuite(entry, tally);
        else runTest(entry, suite, tally);
    }
}

/** Runs every test; returns whether all passed. */
export function runAll(): boolean {
    const tally: Tally = { passed: 0, failed: 0 };
    runSuite(root, tally);
    report(tally.failed === 0 ? `All ${tally.passed} tests passed.` : `${tally.failed} of ${tally.passed + tally.failed} tests failed.`);
    return tally.failed === 0;
}
