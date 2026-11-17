// Items: weapon enchants (imbues, poisons), the bags and the sounds the addon plays.
import type { ClientState, FakeEnchant } from "./client-state";
import { defineGlobals, defineNamespace, defineValues, fake } from "./define";
import { SECRET_VALUE } from "./install-units";

export function installItems(state: ClientState, sounds: number[]): void {
    defineNamespace<typeof C_PaperDollInfo>("C_PaperDollInfo", {
        // One enchant of the hand, as on Forever since 1.60.1: the imbue first
        GetTemporaryEnchantmentInfo: (slot) => {
            if (state.areEnchantReadsBroken) throw new Error("the client gave no answer");
            const enchant = state.enchants[slot] ?? state.temporaryEnchants[slot];
            return enchant ? fake<TemporaryItemEnchantInfo>({ ...enchant, chargesRemaining: 0, hasExpirationTime: true }) : undefined;
        },
    });

    defineNamespace<typeof C_Container>("C_Container", {
        GetItemCooldown: (itemId) => {
            const cooldown = state.itemCooldowns[itemId];
            return $multi(cooldown?.start ?? 0, cooldown?.duration ?? 0, 1);
        },
    });

    defineNamespace<typeof C_Item>("C_Item", {
        // Every enchant of the hand with its kind (3 an imbue, 2 a temporary one), the time left in milliseconds
        GetWeaponEnchantInfo: (weaponSlot) => {
            if (state.areEnchantReadsBroken) throw new Error("the client gave no answer");
            if (state.isEnchantListSecret) return SECRET_VALUE as unknown as WeaponEnchantInfo[];
            const slot = weaponSlot === 1 ? 17 : 16;
            const list: WeaponEnchantInfo[] = [];
            const places: [FakeEnchant | undefined, number][] = [
                [state.enchants[slot], 3],
                [state.temporaryEnchants[slot], 2],
            ];
            for (const [enchant, enchantType] of places) {
                if (enchant === undefined) continue;
                const info = { hasEnchant: true, enchantType, timeLeft: enchant.remainingTimeMs, charges: 0, enchantID: enchant.enchantID };
                list.push(fake<WeaponEnchantInfo>({ ...info, enchantIconID: 0 }));
            }
            return list;
        },
        // Every equipped item is a one-handed mace: item class 2 is a weapon
        GetItemInfoInstant: (item) => $multi(item as number, "Weapon", "Mace", "INVTYPE_WEAPON", 0, 2, 4),
        // By ID; by name only of what is in the bags, as the game does. The name it gives is not needed by the addon, only the ID
        GetItemSpell: (item) => {
            if (type(item) !== "string") return $multi(undefined, state.itemUseSpells[item as number]);
            const id = state.itemIds[item as string];
            return $multi(undefined, id !== undefined && (state.bags[id] ?? 0) > 0 ? state.itemUseSpells[id] : undefined);
        },
        // By ID, or by a name the test gave an item ID
        GetItemCount: (item) => state.bags[(type(item) === "string" ? state.itemIds[item as string] : (item as number)) ?? 0] ?? 0,
        GetItemNameByID: (item) => state.itemNames[item as number],
        GetItemIconByID: () => undefined,
    });

    defineGlobals({
        PlaySoundFile: (file) => {
            if (!state.soundFiles.includes(file)) return false;
            state.playedSoundFiles.push(file);
            return true;
        },
    });

    defineNamespace<typeof C_Sound>("C_Sound", {
        PlaySound: (soundKitId) => {
            sounds.push(soundKitId);
            return $multi(true, sounds.length);
        },
    });
    defineValues({ SOUNDKIT: { ALARM_CLOCK_WARNING_2: 12867, ALARM_CLOCK_WARNING_3: 12889, RAID_WARNING: 8959 } });
}
