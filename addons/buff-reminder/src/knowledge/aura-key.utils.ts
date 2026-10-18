// The form aura names are compared in: the buff state, the buff memory and the buff knowledge all key their lists by it.
import { trimText } from "@wowkit/core";

/**
 * Lowercase, every "(...)" removed, trimmed.
 * "Power Word: Fortitude (Rank 2)" -> "power word: fortitude"
 */
export function buildAuraKey(name: string): string {
    const [stripped] = string.gsub(string.lower(name), "%s*%([^%)]*%)", "");
    return trimText(stripped);
}
