// The look-ahead: while the queue is filled, every spell it takes is assumed to be cast. Its DoT is on the target, its
// buff is up, its cooldown runs, the buff it needed is used up, the combo points change. Slots 2 and 3 so show what
// comes after slot 1, not slot 1 again.
import type { SpellsService } from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import type { StepOptions } from "../knowledge/step.interface";
import type { ComboService } from "./combo.service";
import type { CooldownTrackerService } from "./cooldown-tracker.service";

interface Prediction {
    debuffs: LuaSet<number | string>;
    buffs: LuaSet<number | string>;
    usedBuffs: LuaSet<number | string>;
}

export class LookAheadService {
    private prediction: Prediction | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly nameKeys: NameKeysService,
        private readonly combo: ComboService,
        private readonly cooldownTracker: CooldownTrackerService,
    ) {}

    start(): void {
        this.prediction = { debuffs: new LuaSet(), buffs: new LuaSet(), usedBuffs: new LuaSet() };
        this.combo.startPrediction();
    }

    stop(): void {
        this.prediction = undefined;
        this.combo.stopPrediction();
        this.cooldownTracker.clearPredictions();
    }

    /** The step's spell is assumed cast. */
    noteAssumedCast(spellId: number, opt: StepOptions): void {
        const prediction = this.prediction;
        if (!prediction) return;
        const id = this.spells.resolveOrSame(spellId);
        this.markDebuffs(prediction, id, opt);
        if (opt.isKeptUp === true) this.mark(prediction.buffs, id);
        for (const other of opt.anyBuff ?? []) this.mark(prediction.buffs, other);
        if (opt.needBuff !== undefined) this.mark(prediction.usedBuffs, opt.needBuff);
        this.combo.noteAssumedCast(id, opt.comboMin !== undefined);
        if (opt.isFiller !== true) this.cooldownTracker.markAssumedCooldown(id);
    }

    isPredicting(): boolean {
        return this.prediction !== undefined;
    }

    /** Is the debuff assumed on the target? */
    isDebuffPredicted(spellId: number): boolean {
        return this.prediction !== undefined && this.isMarked(this.prediction.debuffs, spellId);
    }

    /** Is the buff assumed up? */
    isBuffPredicted(spellId: number): boolean {
        return this.prediction !== undefined && this.isMarked(this.prediction.buffs, spellId);
    }

    /** Is the buff assumed used up (Stealth after Garrote)? */
    isBuffUsedUp(spellId: number): boolean {
        return this.prediction !== undefined && this.isMarked(this.prediction.usedBuffs, spellId);
    }

    /** Its DoT is on the target, and so is the debuff it needed (still there) or the one of its group. */
    private markDebuffs(prediction: Prediction, id: number, opt: StepOptions): void {
        if (opt.keepsDebuff !== undefined) {
            this.mark(prediction.debuffs, opt.keepsDebuff === true ? id : opt.keepsDebuff);
            this.mark(prediction.debuffs, id);
        }
        for (const other of opt.anyDebuff ?? []) this.mark(prediction.debuffs, other);
        if (opt.needDebuff !== undefined) this.mark(prediction.debuffs, opt.needDebuff);
    }

    private mark(set: LuaSet<number | string>, spellId: number): void {
        set.add(spellId);
        const key = this.nameKeys.findKeyOf(spellId);
        if (key !== undefined) set.add(key);
    }

    private isMarked(set: LuaSet<number | string>, spellId: number): boolean {
        const resolved = this.spells.resolveOrSame(spellId);
        if (set.has(spellId) || set.has(resolved)) return true;
        const key = this.nameKeys.findKeyOf(resolved);
        return key !== undefined && set.has(key);
    }
}
