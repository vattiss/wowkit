// A buff's stacks (its aura's applications). In a fight the game hides them from addon code: a secret number, which may only
// be compared with nil, or handed to a widget that takes it (see glow-gate.utils). Every secret is looked for before the
// value is touched: even a test of a secret in addon code is an error.
import { attempt } from "./protected-call.utils";

/** The stacks: a number addon code may compare, or a secret one only a widget may take. */
export interface BuffStacks {
    count: number;
    isSecret: boolean;
}

/** No aura, so no stacks: a number addon code may compare. */
const NO_STACKS: BuffStacks = { count: 0, isSecret: false };

/** The stacks of an aura's data; undefined when it has none to tell. An aura of no stacks counts as one. */
export function readAuraStacks(aura: unknown): BuffStacks | undefined {
    if (aura === undefined || issecretvalue(aura) || type(aura) !== "table") return undefined;
    const applications = (aura as { applications?: unknown }).applications;
    if (applications === undefined) return undefined;
    if (issecretvalue(applications)) return { count: applications as number, isSecret: true };
    return type(applications) === "number" ? { count: math.max(1, applications as number), isSecret: false } : undefined;
}

/**
 * The stacks of the buff an icon of the Cooldown Manager shows: by its aura, asked of the game while its ID can be read (the
 * cached data may still hold the stacks it had when the aura came), else by that cached data. No aura on the icon: none.
 * Undefined when the game tells nothing (the whole data secret).
 */
export function readItemStacks(item: CooldownViewerItem): BuffStacks | undefined {
    const instanceId = item.auraInstanceID;
    // A comparison with nil is the one thing allowed on a secret
    if (instanceId === undefined) return NO_STACKS;
    const unit = item.auraDataUnit;
    if (!issecretvalue(instanceId) && unit !== undefined && !issecretvalue(unit)) {
        const live = readAuraStacks(attempt(() => C_UnitAuras.GetAuraDataByAuraInstanceID(unit as UnitToken, instanceId)));
        if (live !== undefined) return live;
    }
    return readAuraStacks(item.auraDataCached);
}

/** The stacks of the player's aura of this spell, as the game hands it; undefined when it hands none (or hides it). */
export function readPlayerAuraStacks(spellId: number): BuffStacks | undefined {
    return readAuraStacks(attempt(() => C_UnitAuras.GetPlayerAuraBySpellID(spellId)));
}
