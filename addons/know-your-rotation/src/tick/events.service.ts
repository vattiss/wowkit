// What happens around the player that changes the cues: a new target, the end of a fight, death, a shapeshift, a totem,
// combo points. Each forgets what no longer holds and asks for a tick.
import { OnEvent, OnGameEvent, OnUnitEvent } from "@wowkit/core";
import type { AurasService, BarRefreshService } from "@wowkit/wow";
import type { RotationQueueService } from "../cues/rotation-queue.service";
import type { AuraMemoryService } from "../state/aura-memory.service";
import type { ComboService } from "../state/combo.service";
import type { HoldTrackerService } from "../state/hold-tracker.service";
import type { TotemTrackerService } from "../state/totem-tracker.service";
import type { TickService } from "./tick.service";

export class EventsService {
    constructor(
        private readonly auras: AurasService,
        private readonly barRefresh: BarRefreshService,
        private readonly combo: ComboService,
        private readonly memory: AuraMemoryService,
        private readonly holds: HoldTrackerService,
        private readonly totems: TotemTrackerService,
        private readonly rotationQueue: RotationQueueService,
        private readonly tick: TickService,
    ) {}

    /** A new target: Classic combo points, the debuffs and the holds stay on the old one; the pass starts over. */
    @OnGameEvent("PLAYER_TARGET_CHANGED")
    noteTargetChanged(): void {
        this.combo.resetEstimate();
        this.memory.clearTargetDebuffs();
        this.holds.noteTargetChanged();
        this.rotationQueue.clearPass();
        this.refreshNow();
    }

    @OnGameEvent("PLAYER_REGEN_ENABLED")
    noteFightEnded(): void {
        this.combo.resetEstimate();
        this.rotationQueue.clearPass();
        this.refreshNow();
    }

    /** Totems vanish when the player dies. */
    @OnGameEvent("PLAYER_DEAD")
    noteDeath(): void {
        this.totems.clearTotems();
        this.refreshNow();
    }

    @OnGameEvent("PLAYER_ALIVE", "PLAYER_UNGHOST", "PLAYER_UPDATE_RESTING", "PLAYER_MOUNT_DISPLAY_CHANGED", "ZONE_CHANGED_NEW_AREA")
    noteStateChanged(): void {
        this.refreshNow();
    }

    /** A shapeshift: the remembered form is out of date, and the main bar shows another page. */
    @OnGameEvent("UPDATE_SHAPESHIFT_FORM")
    noteFormChanged(): void {
        this.memory.forgetForms();
        this.auras.wipeAuraScans();
        this.barRefresh.scheduleBarRemap();
    }

    /** Out of combat the totem slot is readable. */
    @OnGameEvent("PLAYER_TOTEM_UPDATE")
    noteTotemSlot(slot: number): void {
        this.totems.noteTotemSlot(slot);
        this.tick.requestTick();
    }

    @OnUnitEvent("UNIT_POWER_UPDATE")
    noteComboPoints(_unit: UnitToken, powerToken: string): void {
        if (powerToken === "COMBO_POINTS") this.tick.requestTick();
    }

    /** No tick here: auras change in storms, and the 0.2 s tick reads them fresh. */
    @OnUnitEvent("UNIT_AURA")
    forgetPlayerAuras(): void {
        this.auras.wipeAuraScan("player");
    }

    /** The spellbook is read: the spells resolve now. */
    @OnEvent("spellbook.indexed")
    noteSpellBookIndexed(): void {
        this.tick.requestTick();
    }

    private refreshNow(): void {
        this.auras.wipeAuraScans();
        this.tick.requestTick();
    }
}
