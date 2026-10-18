// How spell and aura names are compared. The client writes "(Rank 2)" or "(Cat)" after some names, and the same spell is
// one name in every rank, so names are compared by a key: lower case, every "(...)" removed, trimmed.
import { trimText } from "@wowkit/core";

/** "Power Word: Fortitude (Rank 2)" -> "power word: fortitude". */
export function buildNameKey(name: string): string {
    const [stripped] = string.gsub(string.lower(name), "%s*%([^%)]*%)", "");
    return trimText(stripped);
}
