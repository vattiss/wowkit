// What the client's error messages tell: "You must be behind your target" (Backstab and Shred wait a moment on that
// target), "Your pet is dead" (Revive Pet instead of Call Pet).
import { type EventBus, OnGameEvent } from "@wowkit/core";
import { type ClockService, type SpellDetailsService, type UnitsService, getReadable } from "@wowkit/wow";

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        /** An error message changed what the rotation offers. */
        "rotation.error-noted": [];
    }
}

const NOT_BEHIND_SECONDS = 3;

export class CombatErrorsService {
    private notBehindAt: number | undefined;
    private notBehindTarget: string | undefined;
    private isPetDeadFlag = false;

    constructor(
        private readonly units: UnitsService,
        private readonly details: SpellDetailsService,
        private readonly clock: ClockService,
        private readonly bus: EventBus,
    ) {}

    @OnGameEvent("UI_ERROR_MESSAGE")
    noteErrorMessage(_errorType: number, message: string): void {
        const text = getReadable(message);
        if (text === undefined || type(text) !== "string") return;
        const lower = string.lower(text);
        if (this.details.isNotBehindError(text)) {
            this.notBehindAt = this.clock.getCurrentTime();
            this.notBehindTarget = this.units.getGuid("target");
        } else if (string.find(lower, "pet is dead", 1, true)[0] !== undefined) {
            this.isPetDeadFlag = true;
        } else if (string.find(lower, "have a pet", 1, true)[0] !== undefined) {
            this.isPetDeadFlag = false;
        } else {
            return;
        }
        this.bus.emit("rotation.error-noted");
    }

    /** "Must be behind" on this target a moment ago. */
    hasFailedBehindRecently(): boolean {
        if (this.notBehindAt === undefined || this.clock.getCurrentTime() - this.notBehindAt > NOT_BEHIND_SECONDS) return false;
        const guid = this.units.getGuid("target");
        return guid === undefined || this.notBehindTarget === undefined || guid === this.notBehindTarget;
    }

    /** The hunter's pet is dead: a dead pet unit, or the error after the unit is gone. A live pet clears it. */
    isPetDead(): boolean {
        if (this.units.doesExist("pet")) this.isPetDeadFlag = this.units.isDead("pet") === true;
        return this.isPetDeadFlag;
    }
}
