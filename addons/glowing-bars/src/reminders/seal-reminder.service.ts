// The paladin's seals: in a fight a seal should be up. The client hides the auras in combat, so a seal counts from the
// player's own cast for its 30 seconds (the "seal" category of the buff memory); a Judgement leaves it on. Any seal
// counts, the seals the player added too. The one that glows is the seal the player last used; before the first one the
// addon does not know which seal the player wants, or whether they use one at all, so none glows.
import { OnEvent } from "@wowkit/core";
import type { ActionBarsService, PlayerService, PlayerSpellCast, SpellsService } from "@wowkit/wow";
import { Paladin } from "@wowkit/wow-data";
import type { BuffStateService } from "../character/buff-state.service";
import type { CustomCuesService } from "../glows/custom-cues.service";
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

/** A seal's reminder comes this many seconds before it runs out: one global cooldown, to cast the next in time. */
const SEAL_LEAD = 1.5;

export class SealReminderService {
    /** The seal the player last cast, as the ID the buttons hold. */
    private lastSeal: number | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly buffState: BuffStateService,
        private readonly player: PlayerService,
        private readonly settings: AddonSettingsService,
        private readonly customCues: CustomCuesService,
    ) {}

    /** The seals the player has learned (their wow-data IDs). */
    listSeals(): number[] {
        return SEALS.filter((id) => this.spells.resolve(id) !== undefined);
    }

    /** The learned seals of the list, and the ones the player added (by their IDs). */
    private listAllSeals(): number[] {
        return [...this.listSeals(), ...this.customCues.listCustom("seal")];
    }

    /** A seal cast is the one to glow next time. */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const id = this.spells.resolveOrSame(cast.spellId);
        if (this.listAllSeals().some((sealId) => (this.spells.resolve(sealId) ?? sealId) === id)) this.lastSeal = id;
    }

    /** In a fight with no seal up: the seal the player last used, when it is on a button and switched on. */
    findMissingSeal(): number[] {
        if (!this.settings.get("showSeals") || !this.player.isInCombat()) return [];
        const glowOn = this.settings.get("glowOn");
        const onBars: number[] = [];
        for (const listId of this.listAllSeals()) {
            const id = this.spells.resolve(listId) ?? listId;
            // Any seal counts for every other (one category)
            if (this.buffState.hasAura(id, SEAL_LEAD)) return [];
            if (glowOn[string.format("%d", listId)] !== false && this.actionBars.isOnBars(id)) onBars.push(id);
        }
        return this.lastSeal !== undefined && onBars.includes(this.lastSeal) ? [this.lastSeal] : [];
    }
}
