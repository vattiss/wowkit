// What the specs of the ready cooldowns share.
import type { World } from "@wowkit/test-kit";

/**
 * The cooldown runs, then comes back: a ready cooldown glows as it comes back. One ready at the login does not glow for
 * it: it was ready before (a reload), it did not just come back.
 */
export function recoverCooldown(world: World, spellId: number): void {
    world.state.cooldowns[spellId] = { start: 0, duration: 99999 };
    world.advance(1);
    world.state.cooldowns[spellId] = undefined;
    world.advance(1);
}
