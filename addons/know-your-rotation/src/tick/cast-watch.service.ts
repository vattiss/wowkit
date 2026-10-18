// The player cast a spell: its cooldown and hold start, combo points change, a buff on the player or a debuff on the
// target is remembered, a totem stands, the rotation pass moves on. Then a tick, at once.
import { OnEvent } from "@wowkit/core";
import type { AurasService, PlayerSpellCast } from "@wowkit/wow";
import type { RotationQueueService } from "../cues/rotation-queue.service";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { HealthService } from "../situation/health.service";
import type { AuraMemoryService } from "../state/aura-memory.service";
import type { CastStateService } from "../state/cast-state.service";
import type { ComboService } from "../state/combo.service";
import type { CooldownTrackerService } from "../state/cooldown-tracker.service";
import type { HoldTrackerService } from "../state/hold-tracker.service";
import type { TotemTrackerService } from "../state/totem-tracker.service";
import type { TickService } from "./tick.service";

export class CastWatchService {
    constructor(
        private readonly auras: AurasService,
        private readonly traits: SpellTraitsService,
        private readonly health: HealthService,
        private readonly castState: CastStateService,
        private readonly cooldownTracker: CooldownTrackerService,
        private readonly holds: HoldTrackerService,
        private readonly combo: ComboService,
        private readonly memory: AuraMemoryService,
        private readonly totems: TotemTrackerService,
        private readonly rotationQueue: RotationQueueService,
        private readonly tick: TickService,
    ) {}

    @OnEvent("player.spell-cast")
    noteSpellCast(cast: PlayerSpellCast): void {
        this.castState.noteCast();
        const id = cast.spellId;
        if (id !== undefined) {
            this.noteSelfBuff(id);
            this.cooldownTracker.noteSpellCast(id);
            this.holds.noteSpellCast(id);
            this.combo.noteSpellCast(id);
            this.totems.noteTotemCast(id);
            this.rotationQueue.noteRotationCast(id);
            if (this.traits.isHarmful(id)) this.memory.noteTargetDebuff(id);
        }
        this.auras.wipeAuraScan("player");
        this.auras.wipeAuraScan("target");
        this.tick.requestTick();
    }

    /** A buff cast on the player is up now (an attack is no buff; a heal cast on someone else is not on the player). */
    private noteSelfBuff(spellId: number): void {
        if (this.traits.isHarmful(spellId) && !this.traits.isHelpful(spellId)) return;
        if (this.traits.isHealSpell(spellId) && this.health.findHealUnit() !== "player") return;
        this.memory.rememberBuff(spellId, undefined, undefined, true);
    }
}
