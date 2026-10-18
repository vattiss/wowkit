import type { StepOptions } from "../knowledge/step.interface";
import type { AuraChecksService } from "./aura-checks.service";
import type { PlayerChecksService } from "./player-checks.service";
import type { TargetChecksService } from "./target-checks.service";
import type { TimingChecksService } from "./timing-checks.service";

/** The services that hold the checks, by what they look at. */
export interface StepChecks {
    target: TargetChecksService;
    player: PlayerChecksService;
    aura: AuraChecksService;
    timing: TimingChecksService;
}

/** What every check of a step is given. */
export interface StepContext {
    /** The spell ID the player knows. */
    id: number;
    opt: StepOptions;
    /** Look-ahead in seconds (at least 0.2): what is ready by then counts as ready. */
    gate: number;
    /** Cast on friends. */
    isHelpful: boolean;
    /** The unit a helpful spell would land on (the player otherwise). */
    auraUnit: UnitToken;
}

/** A check: the reason the step is not offered now, or undefined. */
export type StepCheck = (this: void, c: StepContext) => string | undefined;
