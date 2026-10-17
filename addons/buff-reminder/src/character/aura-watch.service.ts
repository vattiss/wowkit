// Auras and casts. No forced tick on auras: aura storms would feel like input lag; the regular
// tick reads them again.
import { OnEvent, OnUnitEvent } from "@wowkit/core";
import type { WeaponReminderService } from "../reminders/weapon/weapon-reminder.service";
import type { RefreshService } from "../tick/refresh.service";
import type { AurasService, PlayerSpellCast } from "@wowkit/wow";

export class AuraWatchService {
    constructor(
        private readonly refresh: RefreshService,
        private readonly auras: AurasService,
        private readonly weaponReminder: WeaponReminderService,
    ) {}

    @OnUnitEvent("UNIT_AURA")
    wipeScan(unit: string): void {
        this.auras.wipeAuraScan(unit);
    }

    /**
     * A cast of a buff is remembered (in combat the client hides the aura), and a weapon buff cast
     * starts the grace time of the weapon reminder.
     */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        this.auras.noteSelfBuff(cast.spellId);
        this.weaponReminder.noteCast(cast.spellId, cast.spellName);
        this.auras.wipeAuraScan("player");
        this.refresh.requestTick();
    }
}
