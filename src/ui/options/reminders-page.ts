// The Reminders page: what the addon reminds about, per character.
import { getText } from "../../locale";
import { getSpellLabel } from "../../wow/spells";
import { getClassBuffs, isBuffEnabled, setBuffEnabled } from "../../reminders/class-buffs";
import { changeSetting, settings } from "../../settings";
import { addCheckbox, addColorSwatch, addFeatureCheckbox, addHeader, addSoundDropdown } from "./controls";
import { addWeaponSection } from "./weapon-section";

/** One checkbox per buff of the class list, labeled with the spell's name. */
function addBuffCheckboxes(category: SettingsCategory): void {
    for (const step of getClassBuffs()) {
        addCheckbox(category, `buff_${step.key}`, getSpellLabel(step.id) ?? step.key, getText("TIP_BUFF_ONE"), step.isOnByDefault, () => isBuffEnabled(step), (isChecked) => setBuffEnabled(step, isChecked));
    }
}

export function registerRemindersPage(root: SettingsCategory): void {
    const [category, layout] = Settings.RegisterVerticalLayoutSubcategory(root, getText("TAB_REMINDERS"));
    const buffs = getClassBuffs();

    addHeader(layout, "HDR_CHARACTER");
    addCheckbox(category, "isMuted", getText("OPT_MUTE"), getText("TIP_MUTE"), false, () => settings.isMuted, (isChecked) => changeSetting("isMuted", isChecked));
    addFeatureCheckbox(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");

    if (buffs.length > 0) {
        addHeader(layout, "HDR_BUFFS");
        addFeatureCheckbox(category, "showBuff", "OPT_BUFF", "TIP_BUFF");
        addBuffCheckboxes(category);
        if (buffs.some((step) => step.party !== undefined)) addFeatureCheckbox(category, "showPartyBuffs", "OPT_PARTY_BUFFS", "TIP_PARTY_BUFFS");
        addSoundDropdown(category, "soundBuff");
        addColorSwatch(category, "buff", "OPT_COLOR_BUFF");
    }

    addWeaponSection(category, layout);

    addHeader(layout, "HDR_MESSAGES");
    addFeatureCheckbox(category, "showBarNotice", "OPT_BAR_NOTICE", "TIP_BAR_NOTICE");
    addFeatureCheckbox(category, "showRankNotice", "OPT_RANK_NOTICE", "TIP_RANK_NOTICE");
    if (buffs.some((step) => step.party?.groupIds !== undefined)) {
        addFeatureCheckbox(category, "showReagentNotice", "OPT_REAGENT_NOTICE", "TIP_REAGENT_NOTICE");
    }

    addHeader(layout, "HDR_DEBUG");
    addCheckbox(category, "isDebugMode", getText("OPT_DEBUG"), getText("TIP_DEBUG"), false, () => settings.isDebugMode, (isChecked) => changeSetting("isDebugMode", isChecked));
}
