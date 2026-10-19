// Which spells glow because they are ready: the important cooldowns, and the procs (a spell the game says is usable now).
// In combat a cooldown glows only when it comes back: one that was never on cooldown in this fight is not news.
import { OnGameEvent } from "@wowkit/core";
import type { ActionBarsService, PlayerService, SpellDetailsService, SpellsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { COOLDOWN_CUES, PROC_CUES } from "./glow-cues.constants";
import { READY_MARGIN, type CooldownTrackerService } from "./cooldown-tracker.service";

export class GlowCuesService {
    /** The cooldowns that have been running at some point of this fight. */
    private usedInCombat = new LuaSet<number>();

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly spellDetails: SpellDetailsService,
        private readonly actionBars: ActionBarsService,
        private readonly tracker: CooldownTrackerService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** A new fight: no cooldown has been used in it yet. */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    forgetUsedCooldowns(): void {
        this.usedInCombat = new LuaSet<number>();
    }

    /**
     * The important cooldowns of the class that are ready and on a button. In combat only the ones that have been on
     * cooldown in this fight (they glow when they are back); out of combat all of them, if the player asked for that.
     */
    findReadyCooldowns(): number[] {
        if (!this.settings.get("showCooldowns")) return [];
        const isInCombat = this.player.isInCombat();
        if (!isInCombat && !this.settings.get("showCooldownsOutOfCombat")) return [];
        const ready: number[] = [];
        for (const id of this.listCues(COOLDOWN_CUES)) {
            if (this.tracker.getRemaining(id) > READY_MARGIN) {
                if (isInCombat) this.usedInCombat.add(id);
            } else if (!isInCombat || this.usedInCombat.has(id)) {
                ready.push(id);
            }
        }
        return ready;
    }

    /** The procs of the class that the game says are usable now, and on a button. */
    findProcs(): number[] {
        if (!this.settings.get("showProcs")) return [];
        return this.listCues(PROC_CUES).filter(
            (id) => this.spellDetails.readUsability(id).isUsable === true && this.tracker.getRemaining(id) <= READY_MARGIN,
        );
    }

    /** The class's cues that are learned, switched on, and on an action button, as the IDs the buttons hold. */
    private listCues(cues: { [classToken: string]: number[] | undefined }): number[] {
        const classToken = this.player.getClassToken();
        const glowOn = this.settings.get("glowOn");
        const found: number[] = [];
        for (const id of classToken !== undefined ? (cues[classToken] ?? []) : []) {
            const learned = this.spells.resolve(id);
            if (learned === undefined || glowOn[String(id)] === false || !this.actionBars.isOnBars(learned)) continue;
            found.push(learned);
        }
        return found;
    }
}
