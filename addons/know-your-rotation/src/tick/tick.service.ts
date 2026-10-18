// One tick: find every cue, then light them up. Every 0.2 seconds, and sooner when something happens (a cast, a new
// target). Nothing while the player is dead, mounted, eating or resting in town, or when the addon is off on this
// character.
import { Interval, OnEvent, type OnFirstLogin, type OnLogout, type OnReady } from "@wowkit/core";
import type { IdleService } from "@forever-reminders/shared";
import type { ActionBarsService, CharacterService, ClockService } from "@wowkit/wow";
import type { MessagesService } from "@wowkit/ui";
import type { RotationQueue } from "../cues/rotation-queue.service";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { HealthService } from "../situation/health.service";
import type { CueFinders, Cues, RotationCue } from "./cues.interface";
import type { GlowsService } from "./glows.service";

/** A requested tick waits this long, so a burst of events gives one tick. */
const REQUEST_DELAY = 0;

export class TickService implements OnFirstLogin, OnLogout, OnReady {
    private isRunning = false;
    private isTickQueued = false;
    private lastInterrupt: number | undefined;
    private lastCleanse: number | undefined;

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly idle: IdleService,
        private readonly actionBars: ActionBarsService,
        private readonly character: CharacterService,
        private readonly clock: ClockService,
        private readonly traits: SpellTraitsService,
        private readonly health: HealthService,
        private readonly finders: CueFinders,
        private readonly glows: GlowsService,
        private readonly messages: MessagesService,
    ) {}

    onFirstLogin(): void {
        this.isRunning = true;
    }

    onLogout(): void {
        this.isRunning = false;
    }

    onReady(): void {
        this.tick();
    }

    /** Something changed (a cast, a new target, an error): tick on the next frame. */
    @OnEvent("rotation.error-noted")
    requestTick(): void {
        if (this.isTickQueued) return;
        this.isTickQueued = true;
        this.clock.runAfter(REQUEST_DELAY, () => {
            this.isTickQueued = false;
            this.tick();
        });
    }

    /** A setting changed: show it at once. */
    @OnEvent("setting.changed")
    redrawAfterSettingChange(): void {
        this.glows.clearGlows();
        this.requestTick();
    }

    @Interval(200)
    tick(): void {
        if (!this.isRunning) return;
        // The maximum health is remembered while the client still shows it
        this.health.getMaxHealth("player");
        const isIdle = this.settings.get("isMuted") || this.idle.shouldStayIdle(this.settings.get("hideResting"));
        const cues = isIdle ? { totems: [], shots: [] } : this.findCues();
        this.playSounds(cues);
        this.glows.showCues(cues);
    }

    private findCues(): Cues {
        const cues = this.findRotationCues();
        if (this.settings.get("showDefense")) {
            const defense = this.finders.defense.findDefense();
            cues.defense = defense !== undefined ? { spellId: defense, isHeal: this.traits.isHealSpell(defense) } : undefined;
            cues.hiddenDefense = this.finders.hidden.findHiddenDefense();
        }
        if (this.settings.get("showInterrupt")) cues.interrupt = this.finders.enemy.findInterrupt();
        if (this.settings.get("showPurge")) cues.purge = this.finders.enemy.findPurge();
        if (this.settings.get("showCleanse")) cues.cleanse = this.finders.support.findCleanse();
        if (this.settings.get("showTotem")) cues.totems = this.finders.support.findTotems();
        return cues;
    }

    /** The rotation glow, the hunter's shots, and the cues on hidden values that belong to the rotation. */
    private findRotationCues(): Cues {
        if (!this.settings.get("showRotation")) return { totems: [], shots: [] };
        const queue = this.finders.rotation.buildQueue();
        const rotation = this.pickRotationCue(queue);
        const hiddenExecute = this.finders.hidden.findHiddenExecute();
        return {
            rotation,
            totems: [],
            shots: this.finders.enemy.findShots(),
            hiddenHeal: this.finders.hidden.findHiddenHeal(),
            hiddenExecute,
            hiddenPetHeal: this.finders.hidden.findHiddenPetHeal(),
            hiddenMana: this.finders.hidden.findHiddenMana(),
            healFade: rotation ? this.findHealFade(queue, rotation.spellId) : undefined,
            finisherFade: rotation && hiddenExecute && rotation.spellId !== hiddenExecute.spellId ? hiddenExecute : undefined,
        };
    }

    /**
     * The spell that glows: the first of the queue that is on an action button, while the first of the queue can be
     * pressed right now.
     */
    private pickRotationCue(queue: RotationQueue): RotationCue | undefined {
        if (!queue.isFirstPressable) return undefined;
        const spellId = queue.spells.find((id) => this.actionBars.isOnBars(id));
        if (spellId === undefined) return undefined;
        return {
            spellId,
            isHeal: queue.heals.has(spellId) || this.traits.isHealSpell(spellId),
            isQuickHeal: queue.quickHeals.has(spellId),
        };
    }

    /** A heal (not kept up) on a party member the player selected, whose health the client hides. */
    private findHealFade(queue: RotationQueue, spellId: number): Cues["healFade"] {
        const step = queue.steps.get(spellId);
        if (!step || step.opt.isKeptUp === true || !(step.opt.isHeal === true || this.traits.isHealSpell(spellId, step.opt)))
            return undefined;
        const unit = this.health.findHealUnit(step.opt);
        if (unit === "player" || !this.character.isInMyGroup(unit) || !this.health.isHealthHidden(unit)) return undefined;
        return { threshold: step.opt.hp ?? 85, unit };
    }

    /** A sound when an interrupt or a cleanse starts to glow. */
    private playSounds(cues: Cues): void {
        if (cues.interrupt !== undefined && cues.interrupt !== this.lastInterrupt)
            this.messages.playAlertSound(this.settings.get("soundInterrupt"));
        this.lastInterrupt = cues.interrupt;
        if (cues.cleanse !== undefined && cues.cleanse !== this.lastCleanse)
            this.messages.playAlertSound(this.settings.get("soundCleanse"));
        this.lastCleanse = cues.cleanse;
    }
}
