// The page of this addon in the Settings panel, per character: one section per cue (only the cues the class has), the
// role and the combat mode, and the help links.
import type { AboutSection, ControlsService, OptionsPage } from "@wowkit/ui";
import type { PlayerService, Rgb } from "@wowkit/wow";
import { CURES, INTERRUPTS, PURGES } from "../knowledge/class-data.constants";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { getGlowColor } from "../settings/settings.colors";
import { COLOR_DEFAULTS } from "../settings/settings.constants";
import type { AddonSettings, AddonSettingsService, ColorKey, CombatMode } from "../settings/settings.interface";
import type { RoleService } from "../situation/role.service";

type SwitchKey = { [K in keyof AddonSettings]: AddonSettings[K] extends boolean ? K : never }[keyof AddonSettings];

const ROLE_LABELS: { [role: string]: TextKey | undefined } = {
    damage: "ROLE_DAMAGE",
    tank: "ROLE_TANK",
    heal: "ROLE_HEAL",
    hybrid: "ROLE_HYBRID",
    caster: "ROLE_CASTER",
    melee: "ROLE_MELEE",
    range: "ROLE_RANGE",
};

export class HighlightsPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly controls: ControlsService<AddonSettings>,
        private readonly player: PlayerService,
        private readonly role: RoleService,
        private readonly about: AboutSection,
    ) {}

    buildPage(category: SettingsCategory, layout: SettingsLayout): void {
        const token = this.player.getClassToken() ?? "";
        this.addHeader(layout, "HDR_CHARACTER");
        this.controls.addSwitchCheckbox(category, "isMuted", this.getText("OPT_MUTE"), this.getText("TIP_MUTE"));
        this.addSwitch(category, "hideResting", "OPT_HIDE_RESTING", "TIP_HIDE_RESTING");
        this.addRotationSection(category, layout, token);
        this.addHeader(layout, "HDR_DEFENSE");
        this.addSwitch(category, "showDefense", "OPT_DEFENSE", "TIP_DEFENSE");
        this.addColor(category, "defense", "OPT_COLOR_DEFENSE");
        this.addCombatCueSections(category, layout, token);
        this.addBehaviorSection(category, layout);
        this.about.addAboutSection(layout);
    }

    private addRotationSection(category: SettingsCategory, layout: SettingsLayout, token: string): void {
        this.addHeader(layout, "HDR_ROTATION");
        this.addSwitch(category, "showRotation", "OPT_ROTATION", "TIP_ROTATION");
        this.addColor(category, "next", "OPT_COLOR_NEXT");
        this.addColor(category, "heal", "OPT_COLOR_HEAL");
        this.addColor(category, "healNow", "OPT_COLOR_HEALNOW");
        if (token === "HUNTER") {
            this.addColor(category, "shot", "OPT_COLOR_SHOT");
            this.addSwitch(category, "showPhysics", "OPT_PHYSICS", "TIP_PHYSICS");
        }
    }

    /** Interrupt, purge, cleanse and totems: only the ones the class has. */
    private addCombatCueSections(category: SettingsCategory, layout: SettingsLayout, token: string): void {
        if (INTERRUPTS[token] !== undefined) {
            this.addHeader(layout, "HDR_INTERRUPT");
            this.addSwitch(category, "showInterrupt", "OPT_INTERRUPT", "TIP_INTERRUPT");
            this.addSound(category, "soundInterrupt");
        }
        if (PURGES[token] !== undefined) {
            this.addHeader(layout, "HDR_PURGE");
            this.addSwitch(category, "showPurge", "OPT_PURGE", "TIP_PURGE");
        }
        if (CURES[token] !== undefined) {
            this.addHeader(layout, "HDR_CLEANSE");
            this.addSwitch(category, "showCleanse", "OPT_CLEANSE", "TIP_CLEANSE");
            this.addSwitch(category, "showGroupCleanse", "OPT_CLEANSE_GROUP", "TIP_CLEANSE_GROUP");
            this.addSound(category, "soundCleanse");
        }
        if (token === "SHAMAN") {
            this.addHeader(layout, "HDR_TOTEM");
            this.addSwitch(category, "showTotem", "OPT_TOTEM", "TIP_TOTEM");
            this.addColor(category, "totem", "OPT_COLOR_TOTEM");
        }
    }

    private addBehaviorSection(category: SettingsCategory, layout: SettingsLayout): void {
        this.addHeader(layout, "HDR_BEHAVIOR");
        this.controls.addDropdown(
            category,
            "role",
            this.getText("OPT_ROLE"),
            this.getText("TIP_ROLE"),
            "auto",
            () => (this.settings.get("isRoleAutomatic") ? "auto" : this.role.resolveRole(this.settings.get("role"))),
            (value) => {
                if (value !== "auto") this.settings.change("role", value);
                this.settings.change("isRoleAutomatic", value === "auto");
            },
            () => [
                ["auto", this.getText("OPT_AUTOMATIC")],
                ...this.role.listRoles().map((role): [string, string] => [role, this.getText(ROLE_LABELS[role] ?? "ROLE_DAMAGE")]),
            ],
        );
        this.controls.addDropdown(
            category,
            "combatMode",
            this.getText("OPT_COMBAT_MODE"),
            this.getText("TIP_COMBAT_MODE"),
            "auto",
            () => this.settings.get("combatMode"),
            (value) => this.settings.change("combatMode", value as CombatMode),
            () => [
                ["auto", this.getText("OPT_AUTOMATIC")],
                ["single", this.getText("MODE_SINGLE")],
                ["aoe", this.getText("MODE_AOE")],
            ],
            true,
        );
        this.controls.addDropdown(
            category,
            "aoeFrom",
            this.getText("OPT_AOE_FROM"),
            this.getText("TIP_AOE_FROM"),
            "3",
            () => tostring(this.settings.get("aoeFrom")),
            (value) => this.settings.change("aoeFrom", tonumber(value) ?? 3),
            () => ["2", "3", "4", "5", "6"].map((count): [string, string] => [count, count]),
            true,
        );
        this.addSwitch(category, "isSmartHeal", "OPT_AUTO_HEAL", "TIP_AUTO_HEAL");
    }

    private addHeader(layout: SettingsLayout, label: TextKey): void {
        this.controls.addHeader(layout, this.getText(label));
    }

    private addSwitch(category: SettingsCategory, key: SwitchKey, label: TextKey, tooltip: TextKey): void {
        this.controls.addSwitchCheckbox(category, key, this.getText(label), this.getText(tooltip));
    }

    private addSound(category: SettingsCategory, key: "soundInterrupt" | "soundCleanse"): void {
        this.controls.addSoundDropdown(
            category,
            key,
            this.getText("OPT_SOUND"),
            this.getText("TIP_SOUND"),
            () => this.settings.get(key),
            (sound) => this.settings.change(key, sound),
        );
    }

    private addColor(category: SettingsCategory, key: ColorKey, label: TextKey): void {
        this.controls.addColorSwatch(
            category,
            key,
            this.getText(label),
            COLOR_DEFAULTS[key],
            () => getGlowColor(this.settings, key),
            (color: Rgb) => this.settings.change("colors", { ...this.settings.get("colors"), [key]: color }),
        );
    }

    private getText(key: TextKey): string {
        return this.locale.getText(key);
    }
}
