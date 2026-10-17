// Weapons and what the weapon reminder remembered about them.
import { OnGameEvent, OnUnitEvent, type OnReady } from "@wowkit/core";
import type { WeaponReminderService } from "../reminders/weapon/weapon-reminder.service";
import type { RefreshService } from "../tick/refresh.service";
import { type PlayerService, type WeaponEnchantsService, MAIN_HAND_SLOT, OFF_HAND_SLOT } from "@wowkit/wow";

export class EquipmentService implements OnReady {
    private mainHandItem: number | undefined;
    private offHandItem: number | undefined;

    constructor(
        private readonly refresh: RefreshService,
        private readonly player: PlayerService,
        private readonly enchants: WeaponEnchantsService,
        private readonly weaponReminder: WeaponReminderService,
    ) {}

    onReady(): void {
        this.mainHandItem = this.player.getEquippedItemId(MAIN_HAND_SLOT);
        this.offHandItem = this.player.getEquippedItemId(OFF_HAND_SLOT);
    }

    /** A different weapon makes what the weapon reminder remembered about the old one wrong. */
    @OnGameEvent("PLAYER_EQUIPMENT_CHANGED")
    noteEquipmentChange(slot: number): void {
        if (slot === MAIN_HAND_SLOT || slot === OFF_HAND_SLOT) {
            const itemId = this.player.getEquippedItemId(slot);
            const previousItemId = slot === MAIN_HAND_SLOT ? this.mainHandItem : this.offHandItem;
            if (itemId !== previousItemId) {
                if (slot === MAIN_HAND_SLOT) this.mainHandItem = itemId;
                else this.offHandItem = itemId;
                this.weaponReminder.clearMemory();
            }
            this.enchants.clearWeaponTooltipCache();
        }
        this.refresh.requestTick();
    }

    @OnUnitEvent("UNIT_INVENTORY_CHANGED")
    noteInventoryChange(): void {
        this.enchants.clearWeaponTooltipCache();
        this.refresh.requestTick();
    }

    @OnGameEvent("WEAPON_ENCHANT_CHANGED")
    noteEnchantChange(): void {
        this.enchants.clearWeaponTooltipCache();
        this.weaponReminder.noteEnchantChanged();
        this.refresh.requestTick();
    }
}
