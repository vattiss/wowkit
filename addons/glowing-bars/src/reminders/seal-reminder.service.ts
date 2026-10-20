// The paladin's seals: in a fight a seal should be up. The client hides the auras in combat, so a seal counts from the
// player's own cast for its 30 seconds (the "seal" category of the buff memory); a Judgement leaves it on. Any seal
// counts; the one that glows is the seal the player last used, else the first on the bars.
import { OnEvent } from "@wowkit/core";
import type { ActionBarsService, PlayerService, PlayerSpellCast, SpellsService } from "@wowkit/wow";
import { Paladin } from "@wowkit/wow-data";
import type { BuffStateService } from "../character/buff-state.service";
import type { AddonSettingsService } from "../settings/settings.interface";

/** The seals, in the order the table lists them (their wow-data IDs). */
export const SEALS = [
    Paladin.SealOfRighteousness,
    Paladin.SealOfCommand,
    Paladin.SealOfTheCrusader,
    Paladin.SealOfWisdom,
    Paladin.SealOfLight,
    Paladin.SealOfJustice,
    Paladin.SealOfFury,
];

export class SealReminderService {
    /** The seal the player last cast, as the ID the buttons hold. */
    private lastSeal: number | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly buffState: BuffStateService,
        private readonly player: PlayerService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** The seals the player has learned (their wow-data IDs). */
    listSeals(): number[] {
        return SEALS.filter((id) => this.spells.resolve(id) !== undefined);
    }

    /** A seal cast is the one to glow next time. */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const id = this.spells.resolveOrSame(cast.spellId);
        if (this.listSeals().some((sealId) => this.spells.resolve(sealId) === id)) this.lastSeal = id;
    }

    /** In a fight with no seal up: the seal to put on, when it is on a button and switched on. */
    findMissingSeal(): number[] {
        if (!this.settings.get("showSeals") || !this.player.isInCombat()) return [];
        const glowOn = this.settings.get("glowOn");
        const onBars: number[] = [];
        for (const listId of this.listSeals()) {
            const id = this.spells.resolve(listId) ?? listId;
            // Any seal counts for every other (one category)
            if (this.buffState.hasAura(id)) return [];
            if (glowOn[string.format("%d", listId)] !== false && this.actionBars.isOnBars(id)) onBars.push(id);
        }
        if (onBars.length === 0) return [];
        return [this.lastSeal !== undefined && onBars.includes(this.lastSeal) ? this.lastSeal : onBars[0]!];
    }
}
