// The game's secret value, as the fake game gives it: issecretvalue knows it (addon code may only compare it with nil).
export const SECRET_VALUE = { isSecret: true };

/** A number the game hides (a buff's stacks in a fight): addon code sees a secret, a widget (a status bar) still reads it. */
export function createSecretNumber(value: number): number {
    return { isSecret: true, hidden: value } as unknown as number;
}

/** Is it a value the game keeps secret from addon code? */
export function isSecretValue(value: unknown): boolean {
    return value === SECRET_VALUE || (type(value) === "table" && (value as { isSecret?: unknown }).isSecret === true);
}

/** The number a widget reads: a plain one, or the one a secret hides; undefined for a secret that hides none. */
export function readHiddenNumber(value: unknown): number | undefined {
    if (type(value) === "number") return value as number;
    return isSecretValue(value) ? (value as { hidden?: number }).hidden : undefined;
}
