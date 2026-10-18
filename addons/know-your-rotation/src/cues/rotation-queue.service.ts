// The rotation queue: up to three spells, the first of which glows. The list is read in order; a spell cast in the
// current pass is skipped until the list is walked through, then the pass starts over. Each spell taken is assumed cast
// (the look-ahead), so the next slots show what comes after it.
//
// - The pull: out of combat, with an enemy not yet in melee range, the first cast-time attack opens (its cast is free
//   while the mob runs in); an offensive racial at the front comes before it.
// - A filler (Lightning Bolt, Heroic Strike) yields to a later action (a shock, a DoT, a cooldown, a proc) that is ready.
// - Slot 1 wants a target confirmed in range; then unknown is fine; slots 2-3 take out of range too.
// - A heal that is needed moves to slot 1 (only slot 1 glows).
import type { Step, StepOptions } from "../knowledge/step.interface";
import type { PlayerService, SpellDetailsService, SpellsService } from "@wowkit/wow";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { ListsService } from "../situation/lists.service";
import type { RangeMode, RangeService } from "../situation/range.service";
import type { TargetService } from "../situation/target.service";
import type { CastStateService } from "../state/cast-state.service";
import type { CooldownTrackerService } from "../state/cooldown-tracker.service";
import type { LookAheadService } from "../state/look-ahead.service";
import type { StepService } from "../steps/step.service";

const QUEUE_SIZE = 3;
/** A step with one of these conditions is an action (a filler before it yields to it when it is ready). */
const ACTION_OPTIONS: (keyof StepOptions)[] = [
    "isHeal",
    "keepsDebuff",
    "isKeptUp",
    "needBuff",
    "needDebuff",
    "proc",
    "isUsableOnly",
    "comboMin",
    "isWithoutPet",
    "isWithPet",
    "isOutOfCombatOnly",
    "hp",
    "manaMax",
    "hpMin",
    "anyBuff",
    "anyDebuff",
];

export interface RotationQueue {
    spells: number[];
    /** The step each queued spell came from. */
    steps: LuaMap<number, Step>;
    /** Queued heals; `quickHeals` are the ones pressed when the health asks for it (not kept up, like a HoT). */
    heals: LuaSet<number>;
    quickHeals: LuaSet<number>;
    /** Can the first spell be pressed right now (ready and not out of range)? */
    isFirstPressable: boolean;
}

/** One build of the queue. */
interface Build {
    queue: RotationQueue;
    list: Step[];
    used: LuaSet<number>;
}

export class RotationQueueService {
    /** Spells cast in the current pass (step keys and "id:<id>"). */
    private readonly spent = new LuaSet<string>();

    constructor(
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly player: PlayerService,
        private readonly traits: SpellTraitsService,
        private readonly lists: ListsService,
        private readonly steps: StepService,
        private readonly range: RangeService,
        private readonly target: TargetService,
        private readonly cooldownTracker: CooldownTrackerService,
        private readonly castState: CastStateService,
        private readonly lookAhead: LookAheadService,
    ) {}

    /** The target changed, or the fight ended: the pass starts over. */
    clearPass(): void {
        for (const key of this.spent) this.spent.delete(key);
    }

    /** A spell of the list was cast: the next suggestions start after it. */
    noteRotationCast(spellId: number): void {
        const resolved = this.spells.resolveOrSame(spellId);
        const step = this.lists
            .getRotation()
            .find((candidate) => candidate.id === resolved || this.spells.resolve(candidate.id) === resolved);
        if (!step) return;
        this.spent.add(step.key);
        this.spent.add(`id:${resolved}`);
    }

    buildQueue(): RotationQueue {
        const build: Build = {
            queue: { spells: [], steps: new LuaMap(), heals: new LuaSet(), quickHeals: new LuaSet(), isFirstPressable: false },
            list: this.lists.getRotation(),
            used: new LuaSet(),
        };
        this.lookAhead.start();
        try {
            this.fillSlots(build);
        } finally {
            this.lookAhead.stop();
        }
        this.takeNeededHealFirst(build);
        const first = build.queue.spells[0];
        const firstStep = first !== undefined ? build.queue.steps.get(first) : undefined;
        build.queue.isFirstPressable =
            first !== undefined &&
            firstStep !== undefined &&
            this.steps.isReady(first, firstStep.opt) &&
            this.range.getRangeState(first, firstStep.opt) !== "out";
        return build.queue;
    }

    /** A filler listed first yields to these when they are pressable; nukes without a cooldown keep list order. */
    isRotationAction(step: Step): boolean {
        const opt = step.opt;
        if (step.isRacial === true || opt.isFiller === true || opt.isAutoRepeat === true) return false;
        if (ACTION_OPTIONS.some((option) => opt[option] !== undefined)) return true;
        return this.cooldownTracker.getCooldownSeconds(step.id) > 0.2;
    }

    /** A step of the rotation (not off, not a cue of its own: totems, the hunter's shots). */
    isConsidered(step: Step): boolean {
        return step.isOn && !this.traits.isCueSpell(step.id);
    }

    private fillSlots(build: Build): void {
        const shift = math.max(0.2, this.castState.getCastRemaining());
        // The spell being cast is not glowed again: it counts as used, so the glow shows what comes next
        const casting = build.list.find((step) => this.isConsidered(step) && this.castState.isCasting(step.id));
        if (casting) {
            build.used.add(this.spells.resolveOrSame(casting.id));
            this.lookAhead.noteAssumedCast(casting.id, casting.opt);
        }
        if (!this.pickPullFirst(build, shift)) this.pickFront(build, shift);
        if (!this.pickOpener(build, shift) && !this.pickNext(build, shift, "in")) this.pickNext(build, shift, "notOut");
        while (build.queue.spells.length < QUEUE_SIZE) {
            if (!this.pickNext(build, shift, "any")) return;
        }
    }

    private isPressable(build: Build, step: Step, shift: number, mode: RangeMode): boolean {
        if (!this.isConsidered(step) || !this.steps.isStepOffered(step.id, step.opt, shift)) return false;
        const id = this.spells.resolveOrSame(step.id);
        return !build.used.has(id) && this.range.isInRange(id, step.opt, mode);
    }

    private isSpent(step: Step): boolean {
        if (this.spent.has(step.key)) return true;
        return this.spent.has(`id:${this.spells.resolveOrSame(step.id)}`);
    }

    private take(build: Build, step: Step): void {
        const id = this.spells.resolveOrSame(step.id);
        build.queue.spells.push(id);
        build.queue.steps.set(id, step);
        build.used.add(id);
        this.markHeal(build.queue, id, step.opt);
        this.lookAhead.noteAssumedCast(step.id, step.opt);
    }

    /** A ready action listed after position `from`. */
    private hasLaterAction(build: Build, from: number, shift: number): boolean {
        for (let j = from + 1; j < build.list.length; j++) {
            const step = build.list[j]!;
            if (
                !this.isSpent(step) &&
                this.isRotationAction(step) &&
                (this.isPressable(build, step, shift, "in") || this.isPressable(build, step, shift, "notOut"))
            ) {
                return true;
            }
        }
        return false;
    }

    private pickOne(build: Build, shift: number, mode: RangeMode): boolean {
        for (let i = 0; i < build.list.length; i++) {
            const step = build.list[i]!;
            if (this.isSpent(step) || !this.isPressable(build, step, shift, mode)) continue;
            if (step.opt.isFiller === true && this.hasLaterAction(build, i, shift)) continue;
            this.take(build, step);
            return true;
        }
        return false;
    }

    /** Go on after the spells cast in this pass; once the pass is used up, start again from the top. */
    private pickNext(build: Build, shift: number, mode: RangeMode): boolean {
        if (this.pickOne(build, shift, mode)) return true;
        if (this.spent.isEmpty()) return false;
        this.clearPass();
        return this.pickOne(build, shift, mode);
    }

    private pickOpener(build: Build, shift: number): boolean {
        if (this.player.isInCombat() || this.castState.getCastRemaining() > 0 || !this.target.isHostile() || this.range.isTargetInMelee())
            return false;
        const opener = build.list.find(
            (step) =>
                step.opt.isAttack === true &&
                step.opt.isAutoRepeat !== true &&
                this.details.getCastTimeMs(this.spells.resolveOrSame(step.id)) > 0 &&
                this.isPressable(build, step, shift, "in"),
        );
        if (!opener) return false;
        this.take(build, opener);
        return true;
    }

    /** A step that goes first at a pull (Hunter's Mark): before the racials and the opener, while it is needed. */
    private pickPullFirst(build: Build, shift: number): boolean {
        const first = build.list.find(
            (step) => step.opt.isPullFirst === true && !this.isSpent(step) && this.isPressable(build, step, shift, "in"),
        );
        if (first) this.take(build, first);
        return first !== undefined;
    }

    /** An offensive racial at the front (Blood Fury, Berserking) comes before the opener: it costs no cast. */
    private pickFront(build: Build, shift: number): void {
        const front = build.list.find(
            (step) => step.isRacial === true && step.isFront === true && !this.isSpent(step) && this.isPressable(build, step, shift, "in"),
        );
        if (front) this.take(build, front);
    }

    /** Only slot 1 glows: a needed heal moves there, even when it already sits in slot 2 or 3. */
    private takeNeededHealFirst(build: Build): void {
        const queue = build.queue;
        const first = queue.spells[0];
        if (first !== undefined && queue.heals.has(first)) return;
        const heal = build.list.find(
            (step) =>
                this.isConsidered(step) &&
                this.traits.isHealSpell(step.id, step.opt) &&
                !this.castState.isCasting(step.id) &&
                this.steps.isStepOffered(step.id, step.opt, 0.2),
        );
        if (!heal) return;
        const id = this.spells.resolveOrSame(heal.id);
        queue.spells = [id, ...queue.spells.filter((queued) => queued !== id)].slice(0, QUEUE_SIZE);
        queue.steps.set(id, heal);
        this.markHeal(queue, id, heal.opt);
    }

    /** A heal kept up (Renew, Shield) glows whenever it is missing; the others are pressed when the health asks for it. */
    private markHeal(queue: RotationQueue, id: number, opt: StepOptions): void {
        if (!this.traits.isHealSpell(id, opt)) return;
        queue.heals.add(id);
        if (opt.isKeptUp !== true) queue.quickHeals.add(id);
    }
}
