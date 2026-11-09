// In a fight the game hides the player's buffs; Blizzard's Cooldown Manager still knows them. How far the addon may use it is
// the player's choice: add what it needs, only read what is there, or leave it alone. On the first login the choice is made
// to change nothing for a player who already uses the manager.
import { OnEvent, OnGameEvent, type OnLogin } from "@wowkit/core";
import type { ClockService, CooldownViewerService, PlayerService, SpellsService } from "@wowkit/wow";
import type { AddedSpellsService } from "../glows/added-spells.service";
import type { GlowCuesService } from "../glows/glow-cues.service";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { SealReminderService } from "../reminders/seal-reminder.service";
import type { TrackingReminderService } from "../reminders/tracking-reminder.service";
import type { AddonSettingsService } from "../settings/settings.interface";

/** After login or a new spec Blizzard is still loading its layouts. */
const TRACK_DELAY = 5;

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
    ) {}

    onLogin(): void {
        this.chooseDefaults();
        this.applyAccess();
        this.waitToTrackBuffs();
    }

    /** Once for each character: the manager a player or another addon already has on stays as it is. */
    private chooseDefaults(): void {
        if (this.settings.get("isCooldownManagerSetUp")) return;
        this.settings.change("isCooldownManagerSetUp", true);
        if (!this.viewer.isRunByOtherAddon() && !this.viewer.isTurnedOn()) return;
        this.settings.change("cooldownManagerAccess", "readOnly");
        this.settings.change("cooldownManagerIcons", "show");
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
        if (this.shouldHideIcons()) this.viewer.hideIcons();
        else if (!isRunByOther) this.viewer.showIcons();
    }

    private shouldHideIcons(): boolean {
        return (
            !this.viewer.isRunByOtherAddon() &&
            this.settings.get("cooldownManagerAccess") !== "off" &&
            this.settings.get("cooldownManagerIcons") === "hide"
        );
    }

    /** The game can show them again with a new layout; a fight is when new icons would be seen. */
    @OnGameEvent("EDIT_MODE_LAYOUTS_UPDATED", "PLAYER_ENTERING_WORLD", "PLAYER_REGEN_DISABLED")
    hideIcons(): void {
        if (this.shouldHideIcons()) this.viewer.hideIcons();
    }

    @OnEvent("setting.changed")
    applyChoice(key: string): void {
        if (key !== "cooldownManagerAccess" && key !== "cooldownManagerIcons") return;
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
