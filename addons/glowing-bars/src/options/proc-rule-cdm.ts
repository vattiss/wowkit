// Whether the Cooldown Manager can tell a proc rule's buff in a fight, when the game hides the buff: its icon is there; the
// addon puts it in Tracked Buffs, which works from the next /reload; the player has to (no Full access); or it cannot, as the
// buff is not on Blizzard's list. Out of a fight the addon reads the buff itself, with none of this.
import type { CooldownViewerService, SpellsService } from "@wowkit/wow";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";

export type CdmStatus = "tracked" | "reload" | "byHand" | "none";

/** The short words of each state in the CDM column, in their color, and its tip. */
export const CDM_TEXTS: { [status in CdmStatus]: { label: TextKey; tip: TextKey; color: string } } = {
    tracked: { label: "CDM_TRACKED", tip: "TIP_CDM_TRACKED", color: "|cff40ff40" },
    reload: { label: "CDM_RELOAD", tip: "TIP_CDM_RELOAD", color: "|cffffd100" },
    byHand: { label: "CDM_BY_HAND", tip: "TIP_CDM_BY_HAND", color: "|cffff8020" },
    none: { label: "CDM_NONE", tip: "TIP_CDM_NONE", color: "|cff9d9d9d" },
};

/** Where the buff stands with the Cooldown Manager now. */
export function findCdmStatus(
    buffId: number,
    spells: SpellsService,
    viewer: CooldownViewerService,
    settings: AddonSettingsService,
): CdmStatus {
    const name = spells.getSpellName(buffId);
    if (name === undefined) return "none";
    // An icon with a say: in Tracked Buffs, running
    if (viewer.isBuffActive(name) !== undefined) return "tracked";
    if (!viewer.listCatalog().some((entry) => entry.names.includes(name))) return "none";
    return settings.get("cooldownManagerAccess") === "full" ? "reload" : "byHand";
}
