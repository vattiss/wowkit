// The weapon buff part of the Reminders page: the switch, which buff to keep up (one per hand for
// classes that coat both weapons), the sound and the color.
import { getText, type TextKey } from "../../locale";
import { getSpellLabel } from "../../wow/spells";
import { findAutomaticWeaponBuff, getWeaponChoices, hasOffhandChoice, isWeaponBuffLearned } from "../../reminders/weapon-choice";
import { changeSetting, settings } from "../../settings";
import { addColorSwatch, addDropdown, addFeatureCheckbox, addHeader, addSoundDropdown } from "./controls";

/** The pick of the weapon buff: "auto" (the best one learned) or one of the learned buffs. */
function addWeaponPick(category: SettingsCategory, key: "weaponBuff" | "weaponBuffOff", label: TextKey, isOffhand: boolean): void {
    addDropdown(
        category,
        key,
        label,
        "TIP_WEAPON_PICK",
        "auto",
        () => {
            const picked = getWeaponChoices().find((entry) => entry.key === settings[key]);
            return picked && isWeaponBuffLearned(picked) ? picked.key : "auto";
        },
        (value) => changeSetting(key, value !== "auto" ? value : undefined),
        () => {
            const auto = findAutomaticWeaponBuff(isOffhand);
            const autoLabel = auto ? `${getText("OPT_AUTOMATIC")} (${auto.entry.name ?? getSpellLabel(auto.entry.id) ?? auto.entry.key})` : getText("OPT_AUTOMATIC");
            const list: [string, string][] = [["auto", autoLabel]];
            for (const entry of getWeaponChoices()) {
                if (isWeaponBuffLearned(entry)) list.push([entry.key, entry.name ?? getSpellLabel(entry.id) ?? entry.key]);
            }
            return list;
        },
    );
}

/** Nothing is added for a class without weapon buffs. */
export function addWeaponSection(category: SettingsCategory, layout: SettingsLayout): void {
    if (getWeaponChoices().length === 0) return;
    addHeader(layout, "HDR_WEAPON");
    addFeatureCheckbox(category, "showWeapon", "OPT_WEAPON", "TIP_WEAPON");
    if (hasOffhandChoice()) {
        addWeaponPick(category, "weaponBuff", "OPT_WEAPON_PICK_MAIN", false);
        addWeaponPick(category, "weaponBuffOff", "OPT_WEAPON_PICK_OFF", true);
    } else {
        addWeaponPick(category, "weaponBuff", "OPT_WEAPON_PICK", false);
    }
    addSoundDropdown(category, "soundWeapon");
    addColorSwatch(category, "weapon", "OPT_COLOR_WEAPON");
}
