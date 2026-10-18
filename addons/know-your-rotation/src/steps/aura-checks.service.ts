// The conditions of a step about auras: a buff or debuff kept up (offered while it is missing or about to run out),
// the buffs and debuffs a spell needs, and the groups of which one at a time is enough (one seal, one curse).
//
// Aura first: a readable read decides, and a missing aura clears the spell's hold. The hold and the memory only stand
// in when the client hides the auras.
import type { StepContext } from "./step-check.interface";
import type { AuraReaderService } from "../state/aura-reader.service";
import type { HoldTrackerService } from "../state/hold-tracker.service";
import type { PlayerService } from "@wowkit/wow";

/** A debuff kept up is offered again under this many seconds left (by default). */
const DEBUFF_REFRESH = 6;
/** From this many seconds left an aura counts as one without an end. */
const ENDLESS = 9000;

export class AuraChecksService {
    constructor(
        private readonly auraReader: AuraReaderService,
        private readonly holds: HoldTrackerService,
        private readonly player: PlayerService,
    ) {}

    /** A buff kept up (a seal, a HoT on the healed unit): offered while it is missing, or until it has its stacks. */
    checkKeptUp(c: StepContext): string | undefined {
        const unit = c.opt.isHeal === true ? (c.opt.unit ?? c.auraUnit) : "player";
        const read = this.auraReader.findAura(c.id, unit, "HELPFUL");
        if (read.isFound) return this.judgeFoundBuff(c, read.stacks, read.remain);
        if (!read.isUnreadable) this.holds.clearHold(c.id);
        // Hidden, or in combat with no auras shown: the memory says whether it is up
        const isRemembered = (read.isUnreadable || this.player.isInCombat()) && this.auraReader.hasAura(c.id, unit, "HELPFUL");
        return isRemembered ? "already active" : undefined;
    }

    /** A kept-up buff that is up: offered again while it is short of its stacks or about to run out. */
    private judgeFoundBuff(c: StepContext, stacks: number, remain: number): string | undefined {
        if (c.opt.stacks !== undefined && stacks < c.opt.stacks) {
            this.holds.clearHold(c.id);
            return undefined;
        }
        return this.isStillUp(remain, c.opt.refresh ?? 0) ? "already active" : undefined;
    }

    /** A debuff kept up on the target (the spell's own, or another one): offered while missing or about to run out. */
    checkKeptDebuff(c: StepContext): string | undefined {
        const debuff = c.opt.keepsDebuff === true ? c.id : c.opt.keepsDebuff!;
        // A seal is helpful, but its judgement debuff is on the enemy
        const unit = c.opt.unit ?? (c.isHelpful && c.opt.isHeal === true ? c.auraUnit : "target");
        const read = this.auraReader.findAura(debuff, unit, "HARMFUL");
        if (read.isFound) {
            if (c.opt.stacks !== undefined && read.stacks < c.opt.stacks) this.holds.clearHold(c.id);
            else if (this.isStillUp(read.remain, c.opt.refresh ?? DEBUFF_REFRESH)) return "already active";
            else this.holds.clearHold(c.id);
        } else if (!read.isUnreadable) {
            this.holds.clearHold(c.id);
        } else if (this.auraReader.hasAura(debuff, unit, "HARMFUL")) {
            return "already active";
        }
        return undefined;
    }

    checkNeedBuff(c: StepContext): string | undefined {
        return this.auraReader.hasAura(c.opt.needBuff!, "player", "HELPFUL") ? undefined : "needs a buff you do not have";
    }

    checkNeedAnyBuff(c: StepContext): string | undefined {
        return c.opt.needAnyBuff!.some((id) => this.auraReader.hasAura(id, "player", "HELPFUL"))
            ? undefined
            : "needs a buff you do not have";
    }

    checkNeedDebuff(c: StepContext): string | undefined {
        return this.auraReader.hasAura(c.opt.needDebuff!, c.opt.unit ?? "target", "HARMFUL")
            ? undefined
            : "needs a debuff on the target first";
    }

    checkAnyBuff(c: StepContext): string | undefined {
        const isUp = c.opt.anyBuff!.some((id) => this.auraReader.hasAura(id, "player", "HELPFUL"));
        return isUp ? "a buff from the same group is already up" : undefined;
    }

    checkAnyDebuff(c: StepContext): string | undefined {
        const isUp = c.opt.anyDebuff!.some((id) => this.auraReader.hasAura(id, c.opt.unit ?? "target", "HARMFUL"));
        return isUp ? "a debuff from the same group is already on the target" : undefined;
    }

    /** Up, and not near its end: without an end, with no refresh time, or more seconds left than the refresh time. */
    private isStillUp(remain: number, refresh: number): boolean {
        return remain >= ENDLESS || refresh <= 0 || remain > refresh;
    }
}
