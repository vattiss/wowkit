// Combo points. The client may hide them in combat, so a count of builders and finishers since the last target change
// backs them up: the highest of the count and what the client says is used. While the look-ahead runs it has its own
// count (a builder it assumes is cast adds one, a finisher spends them).
import type { PlayerService } from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import { COMBO_BUILDERS, COMBO_FINISHERS } from "../knowledge/spell-data.constants";

const MAX_COMBO = 5;

export class ComboService {
    private estimate = 0;
    private predicted: number | undefined;
    /** Where the last raw read came from, for the reason a finisher waits. */
    private lastSource = "count";

    constructor(
        private readonly player: PlayerService,
        private readonly nameKeys: NameKeysService,
    ) {}

    /** The combo points now (the look-ahead's while it runs). */
    getComboPoints(): number {
        return this.predicted ?? this.readRawComboPoints();
    }

    /** The combo points as read, and where from ("count", or the client). */
    describeComboPoints(): string {
        return `${this.readRawComboPoints()}, read from ${this.lastSource}`;
    }

    isBuilder(spellId: number): boolean {
        return this.nameKeys.isOneOf(spellId, "combo builders", COMBO_BUILDERS);
    }

    noteSpellCast(spellId: number): void {
        if (this.nameKeys.isOneOf(spellId, "combo finishers", COMBO_FINISHERS)) this.estimate = 0;
        else if (this.isBuilder(spellId)) this.estimate = math.min(MAX_COMBO, this.estimate + 1);
    }

    /** Classic combo points stay on the old target. */
    resetEstimate(): void {
        this.estimate = 0;
    }

    startPrediction(): void {
        this.predicted = this.readRawComboPoints();
    }

    /** The look-ahead assumes a cast: a finisher spends the points, a builder adds one. */
    noteAssumedCast(spellId: number, isFinisher: boolean): void {
        if (isFinisher) this.predicted = 0;
        else if (this.isBuilder(spellId)) this.predicted = math.min(MAX_COMBO, (this.predicted ?? 0) + 1);
    }

    stopPrediction(): void {
        this.predicted = undefined;
    }

    private readRawComboPoints(): number {
        const read = this.player.readComboPoints();
        if (read !== undefined && read > this.estimate) {
            this.lastSource = "the client";
            return read;
        }
        this.lastSource = "count";
        return this.estimate;
    }
}
