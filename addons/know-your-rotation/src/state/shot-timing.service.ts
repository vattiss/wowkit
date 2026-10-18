// Classic timing without the combat log: the Auto Shot timer (so Aimed Shot, Multi-Shot and Volley do not delay the
// next Auto Shot) and the 2-second energy tick (a spell whose energy arrives with the next tick is offered already).
import { OnEvent, OnGameEvent, OnUnitEvent } from "@wowkit/core";
import { Hunter } from "@wowkit/wow-data";
import type { ClockService, PlayerService, PlayerSpellCast, SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";

/** A cast in the last this many seconds before an Auto Shot would delay it. */
const CLIP_WINDOW = 0.4;
const ENERGY_TICK = 2;
/** A spell whose energy arrives within this many seconds is offered. */
const ENERGY_WAIT = 0.45;
const ENERGY = 3;
const CLIP_SPELLS = [Hunter.AimedShot, Hunter.MultiShot, Hunter.Volley];

export class ShotTimingService {
    private shotAt = 0;
    private shotSpeed = 0;
    /** The last readable ranged speed (hidden in combat). */
    private knownSpeed = 0;
    private energyTickAt = 0;
    private lastEnergy = -1;

    constructor(
        private readonly player: PlayerService,
        private readonly units: UnitsService,
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly clock: ClockService,
        private readonly settings: AddonSettingsService,
    ) {}

    @OnEvent("player.spell-cast")
    noteAutoShot(cast: PlayerSpellCast): void {
        if (cast.spellId !== Hunter.AutoShot) return;
        const speed = this.readRangedSpeed();
        this.shotSpeed = speed > 0 ? speed : 3;
        this.shotAt = this.clock.getCurrentTime();
    }

    @OnGameEvent("PLAYER_REGEN_ENABLED")
    forgetAutoShot(): void {
        this.shotAt = 0;
    }

    /** Energy rises by about 20 on each tick (40 with Adrenaline Rush): a gain like that is a tick. */
    @OnUnitEvent("UNIT_POWER_UPDATE")
    noteEnergy(): void {
        const current = this.units.readPower("player", ENERGY)?.current;
        if (this.energyTickAt <= 0) this.energyTickAt = this.clock.getCurrentTime();
        if (current === undefined) return;
        if (this.lastEnergy >= 0) {
            const gain = current - this.lastEnergy;
            if ((gain >= 18 && gain <= 22) || (gain >= 37 && gain <= 43)) this.energyTickAt = this.clock.getCurrentTime();
        }
        this.lastEnergy = current;
    }

    /** A hunter shot that would delay Auto Shot waits (when the option is on). */
    doesBlock(spellId: number): boolean {
        if (!this.settings.get("showPhysics")) return false;
        const resolved = this.spells.resolve(spellId);
        const isClip = CLIP_SPELLS.includes(spellId) || (resolved !== undefined && CLIP_SPELLS.includes(resolved));
        return isClip && this.isAutoShotDue();
    }

    /** The energy for this spell arrives with the next tick, right now. */
    isEnergySoon(spellId: number): boolean {
        const cost = this.details.listCosts(this.spells.resolveOrSame(spellId)).find((entry) => entry.powerType === ENERGY)?.amount ?? 0;
        if (cost <= 0) return false;
        const current = this.units.readPower("player", ENERGY)?.current;
        if (current === undefined || current >= cost || current + 20 < cost) return false;
        if (this.energyTickAt <= 0) return false;
        const elapsed = this.clock.getCurrentTime() - this.energyTickAt;
        const tickIn = elapsed < 0 ? ENERGY_TICK : ENERGY_TICK - (elapsed % ENERGY_TICK);
        return tickIn <= ENERGY_WAIT;
    }

    /** The next Auto Shot is about to fire: a cast now would delay it. */
    private isAutoShotDue(): boolean {
        if (this.shotAt <= 0 || this.shotSpeed <= 0) return false;
        const elapsed = this.clock.getCurrentTime() - this.shotAt;
        if (elapsed > this.shotSpeed + 0.5) return false;
        const left = math.max(0, this.shotSpeed - elapsed);
        return left > 0.08 && left <= CLIP_WINDOW;
    }

    private readRangedSpeed(): number {
        const speed = this.player.getRangedSpeed();
        if (speed !== undefined) {
            this.knownSpeed = speed;
            return speed;
        }
        if (this.knownSpeed <= 0.4) this.knownSpeed = this.player.getRangedWeaponSpeed() ?? 0;
        return this.knownSpeed;
    }
}
