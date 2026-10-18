import type { DefenseCueService } from "../cues/defense-cue.service";
import type { EnemyCuesService } from "../cues/enemy-cues.service";
import type { HiddenCue, HiddenCuesService } from "../cues/hidden-cues.service";
import type { RotationQueueService } from "../cues/rotation-queue.service";
import type { SupportCuesService } from "../cues/support-cues.service";

/** The services that find the cues; the tick asks each in turn. */
export interface CueFinders {
    rotation: RotationQueueService;
    hidden: HiddenCuesService;
    defense: DefenseCueService;
    enemy: EnemyCuesService;
    support: SupportCuesService;
}

/** The rotation spell that glows: a heal glows green (`isQuickHeal`: mint, pressed when the health asks for it). */
export interface RotationCue {
    spellId: number;
    isHeal: boolean;
    isQuickHeal: boolean;
}

/** Everything one tick found to light up. Undefined or empty: nothing of that kind. */
export interface Cues {
    rotation?: RotationCue;
    defense?: { spellId: number; isHeal: boolean };
    interrupt?: number;
    purge?: number;
    cleanse?: number;
    totems: number[];
    shots: number[];
    hiddenHeal?: HiddenCue;
    hiddenDefense?: HiddenCue;
    hiddenExecute?: HiddenCue;
    hiddenPetHeal?: HiddenCue;
    hiddenMana?: HiddenCue;
    /** The rotation glow fades out where a finisher on a target with hidden health fades in. */
    finisherFade?: HiddenCue;
    /** A heal on a party member whose health is hidden: its glow is lit by that member's health. */
    healFade?: { threshold: number; unit: UnitToken };
}
