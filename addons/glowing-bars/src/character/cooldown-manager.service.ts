// In a fight the game hides the player's buffs; Blizzard's Cooldown Manager still knows them. How far the addon may use it is
// the player's choice: add what it needs, only read what is there, or leave it alone. On the first login the choice is made
// to change nothing for a player who already uses the manager.
import { OnEvent, OnGameEvent, type OnLogin } from "@wowkit/core";
import {
    COOLDOWN_WINDOWS,
    type ButtonRegistryService,
    type ClockService,
    type CooldownViewerService,
    type CooldownWindow,
    type GlowService,
    type PlayerService,
    type SpellsService,
} from "@wowkit/wow";
import type { AddedSpellsService } from "../glows/added-spells.service";
import type { GlowCuesService } from "../glows/glow-cues.service";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { SealReminderService } from "../reminders/seal-reminder.service";
import type { TrackingReminderService } from "../reminders/tracking-reminder.service";
import { WINDOW_ICONS_SETTINGS } from "../settings/settings.constants";
import type { AddonSettingsService } from "../settings/settings.interface";

/** After login or a new spec Blizzard is still loading its layouts. */
const TRACK_DELAY = 5;
/** How often the windows kept out of sight are looked after. */
const HIDE_CHECK_SECONDS = 1;

export class CooldownManagerService implements OnLogin {
    private isTrackingDue = false;

    constructor(
        private readonly viewer: CooldownViewerService,
        private readonly player: PlayerService,
        private readonly settings: AddonSettingsService,
        private readonly spells: SpellsService,
        private readonly clock: ClockService,
        private readonly classBuffs: ClassBuffsService,
        private readonly addedSpells: AddedSpellsService,
        private readonly seals: SealReminderService,
        private readonly trackings: TrackingReminderService,
        private readonly glowCues: GlowCuesService,
        private readonly glow: GlowService,
        private readonly buttons: ButtonRegistryService,
    ) {}

    onLogin(): void {
        this.chooseDefaults();
        this.buttons.useOtherPlaces((spellId) => this.hasGlowIcon(spellId));
        this.glow.useExtraTargets(
            (spellId) => this.listGlowIcons(spellId),
            () => (this.listGlowWindows().length > 0 ? this.viewer.getIconsKey(this.listGlowWindows()) : ""),
        );
        this.applyAccess();
        this.ensureIconsHidden();
        this.waitToTrackBuffs();
    }

    /** The windows that glow. The icons must be on the screen: a glow on a hidden one would float over nothing. */
    private listGlowWindows(): CooldownWindow[] {
        if (this.settings.get("cooldownManagerAccess") === "off") return [];
        const barsThatGlow = this.settings.get("barsThatGlow");
        const hidden = this.listHiddenWindows();
        return COOLDOWN_WINDOWS.filter((window) => barsThatGlow[window] !== false && !hidden.includes(window));
    }

    /** A spell only in the Cooldown Manager can be reminded of too: the icon is where the player looks. */
    private hasGlowIcon(spellId: number): boolean {
        const windows = this.listGlowWindows();
        const name = windows.length > 0 ? this.spells.getSpellName(spellId) : undefined;
        return name !== undefined && this.viewer.hasDrawnIcon(name, windows);
    }

    private listGlowIcons(spellId: number): ActionButton[] {
        const windows = this.listGlowWindows();
        const name = windows.length > 0 ? this.spells.getSpellName(spellId) : undefined;
        return name !== undefined ? this.viewer.findIconsOf(name, windows) : [];
    }

    /**
     * Once for each character. A manager the player or another addon already has on keeps its windows. The game can have it on
     * for a character nobody has played yet, so one the addon has never seen still gets what it needs put on display.
     */
    private chooseDefaults(): void {
        if (this.settings.get("isCooldownManagerSetUp")) return;
        this.settings.change("isCooldownManagerSetUp", true);
        if (!this.viewer.isRunByOtherAddon() && !this.viewer.isTurnedOn()) return;
        const isNewCharacter = !this.settings.get("isWelcomeDone") && !this.viewer.isRunByOtherAddon();
        this.settings.change("cooldownManagerAccess", isNewCharacter ? "full" : "readOnly");
        for (const window of COOLDOWN_WINDOWS) this.settings.change(WINDOW_ICONS_SETTINGS[window], "show");
    }

    private applyAccess(): void {
        const isOff = this.settings.get("cooldownManagerAccess") === "off";
        const isRunByOther = this.viewer.isRunByOtherAddon();
        this.viewer.useIcons(!isOff);
        if (isOff && this.settings.get("isCooldownManagerOurs")) {
            this.viewer.disable();
            this.settings.change("isCooldownManagerOurs", false);
        }
        if (!isOff && !isRunByOther && !this.viewer.isTurnedOn()) {
            this.viewer.enable();
            this.settings.change("isCooldownManagerOurs", true);
        }
        const hidden = this.listHiddenWindows();
        this.viewer.hideIcons(hidden);
        if (!isRunByOther) this.viewer.showIcons(COOLDOWN_WINDOWS.filter((window) => !hidden.includes(window)));
    }

    /** The windows the addon keeps out of sight. */
    private listHiddenWindows(): CooldownWindow[] {
        if (this.viewer.isRunByOtherAddon() || this.settings.get("cooldownManagerAccess") === "off") return [];
        return COOLDOWN_WINDOWS.filter((window) => this.settings.get(WINDOW_ICONS_SETTINGS[window]) === "hide");
    }

    /** Edit Mode gives a window its opacity back whenever it applies its settings, and not every time is announced by an event. */
    private ensureIconsHidden(): void {
        if (!this.player.isInCombat()) this.viewer.hideIcons(this.listHiddenWindows());
        this.clock.runAfter(HIDE_CHECK_SECONDS, () => this.ensureIconsHidden());
    }

    /** The game can show them again with a new layout; a fight is when new icons would be seen. */
    @OnGameEvent("EDIT_MODE_LAYOUTS_UPDATED", "PLAYER_ENTERING_WORLD", "PLAYER_REGEN_DISABLED")
    hideIcons(): void {
        this.viewer.hideIcons(this.listHiddenWindows());
    }

    @OnEvent("setting.changed")
    applyChoice(key: string): void {
        if (key !== "cooldownManagerAccess" && !COOLDOWN_WINDOWS.some((window) => WINDOW_ICONS_SETTINGS[window] === key)) return;
        this.applyAccess();
        if (this.settings.get("cooldownManagerAccess") === "full") this.waitToTrackBuffs();
    }

    /** Blizzard keeps a layout for each spec, and what the addon wrote can be overwritten: asked again at each login. */
    @OnGameEvent("ACTIVE_PLAYER_SPECIALIZATION_CHANGED")
    waitToTrackBuffs(): void {
        this.isTrackingDue = true;
        this.clock.runAfter(TRACK_DELAY, () => this.trackBuffs());
    }

    /** In peace: a fight or layouts still loading put it off until the end of the next fight. */
    @OnGameEvent("PLAYER_REGEN_ENABLED")
    trackBuffs(): void {
        if (!this.isTrackingDue || this.player.isInCombat()) return;
        if (this.settings.get("cooldownManagerAccess") !== "full") {
            this.isTrackingDue = false;
            return;
        }
        if (this.viewer.trackBuffs(this.listWantedNames())) this.isTrackingDue = false;
    }

    /** The buffs of the table of this class, by name: every rank goes by one. */
    private listWantedNames(): string[] {
        const ids = [
            ...this.seals.listSeals(),
            ...this.trackings.listTrackings(),
            ...this.addedSpells.listAdded("missingBuff"),
            ...this.glowCues.listBuiltInIds("proc"),
            ...this.glowCues.listCueIds("readyCooldown"),
            ...this.glowCues.listProcAuras(),
        ];
        for (const classBuff of this.classBuffs.getClassBuffs()) ids.push(classBuff.id, ...(classBuff.categoryMembers ?? []));
        const names = new LuaSet<string>();
        for (const id of ids) {
            const name = this.spells.getSpellName(this.addedSpells.getEffectiveId(id));
            if (name !== undefined && name !== "") names.add(name);
        }
        const list: string[] = [];
        for (const name of names) list.push(name);
        return list;
    }
}
