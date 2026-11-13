// The controls every reminder has on the Reminders page, in this addon's words: a switch, and the number of members a
// group buff waits for. Built on the generic controls of @wowkit/ui. The look of a reminder (color, glow %, message,
// sound) is the table's.
import type { ControlsService, OptionsTab, OptionRow } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { GROUP_FROM_CHOICES } from "../settings/settings.constants";
import type { AddonSettings, AddonSettingsService } from "../settings/settings.interface";

type FeatureKey =
    | "shouldShowGreeting"
    | "shouldStayQuietInTowns"
    | "isAfkRainbowOn"
    | "shouldGlowOnMacros"
    | "shouldGlowOnEveryMacroSpell"
    | "isMissingBuffEnabled"
    | "isWeaponBuffEnabled"
    | "showPartyBuffs"
    | "showRaidBuffs"
    | "shouldGlowTotemsOnlyOnTotemBar"
    | "shouldNoteOwnOlderRankBuffs"
    | "shouldNoteOthersOlderRankBuffs"
    | "isOldRankEnabled"
    | "isLowReagentEnabled"
    | "isReadyCooldownEnabled"
    | "showCooldownsAtFightStart"
    | "isProcEnabled";

export class ReminderControlsService {
    constructor(
        private readonly controls: ControlsService<AddonSettings>,
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
    ) {}

    addHeader(tab: OptionsTab, label: TextKey): void {
        this.controls.addHeader(tab, this.locale.getText(label));
    }

    /** A switch of a feature, on or off by default as the settings say. */
    addSwitch(tab: OptionsTab, key: FeatureKey, label: TextKey, tooltip: TextKey): OptionRow {
        return this.controls.addSwitchCheckbox(tab, key, this.locale.getText(label), this.locale.getText(tooltip));
    }

    /**
     * From how many missing a buff its group version is asked for (1 to 5), under the switch of the party or the
     * raid buffs, greyed out while that switch is off.
     */
    addGroupMin(
        tab: OptionsTab,
        key: "partyGroupFrom" | "raidGroupFrom",
        tooltip: TextKey,
        parentKey: "showPartyBuffs" | "showRaidBuffs",
    ): void {
        this.controls
            .addDropdown(
                tab,
                key,
                this.locale.getText("OPT_GROUP_FROM"),
                this.locale.getText(tooltip),
                string.format("%d", this.settings.getDefault(key)),
                () => string.format("%d", this.settings.get(key)),
                (value) => this.settings.change(key, tonumber(value) ?? this.settings.getDefault(key)),
                () =>
                    GROUP_FROM_CHOICES.map((count): [string, string] => [
                        string.format("%d", count),
                        string.format(this.locale.getText(count === 1 ? "OPT_MEMBER_MISSING" : "OPT_MEMBERS_MISSING"), count),
                    ]),
                true,
            )
            .enableWhen(() => this.settings.get(parentKey))
            .setIndented();
    }
}
