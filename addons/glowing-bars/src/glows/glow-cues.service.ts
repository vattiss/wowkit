// Which spells glow because they are ready: the important cooldowns, and the procs (a spell the game says is usable now).
// In combat a cooldown counts only once it comes back: one that was never on cooldown in this fight is not news. How long
// it glows then is its glow time (a few seconds by default: one that waits for the right moment should not glow all the
// while).
import { OnEvent, OnGameEvent } from "@wowkit/core";
import type { ActionBarsService, PlayerService, SpellDetailsService, SpellsService, CooldownViewerService } from "@wowkit/wow";
import type { AddonSettingsService, AddableType } from "../settings/settings.interface";
import type { AddedSpellsService } from "./added-spells.service";
import { COOLDOWN_CUES, PROC_CUES, RACIAL_COOLDOWNS, SPELL_PROC_CUES } from "./glow-cues.constants";
import { READY_MARGIN, type CooldownTrackerService } from "./cooldown-tracker.service";
import type { StanceProcsService } from "./stance-procs.service";
import type { StyleService } from "../settings/style.service";

export class GlowCuesService {
    /** The cooldowns that have been running at some point of this fight (or ready as it started, if the player asked). */
    private usedInCombat = new LuaSet<number>();
    /** The spells of each type, kept until the settings or the spells change: every tick asks for them. */
    private readonly cueIds = new LuaMap<AddableType, number[]>();

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly spellDetails: SpellDetailsService,
        private readonly actionBars: ActionBarsService,
        private readonly tracker: CooldownTrackerService,
        private readonly settings: AddonSettingsService,
        private readonly addedSpells: AddedSpellsService,
        private readonly stanceProcs: StanceProcsService,
        private readonly cooldownViewer: CooldownViewerService,
        private readonly styles: StyleService,
    ) {}

    /**
     * A new fight: what was used in the last one is forgotten, and a cooldown that is running as it starts counts as used
     * in it (it glows when it is back). Read now, while the client may still show the cooldowns. If the player asked for it,
     * the ready ones count too, as if they had just come back: they glow right away, a reminder to use them.
     */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    startFight(): void {
        this.usedInCombat = new LuaSet<number>();
        const isReadyGlowing = this.settings.get("showCooldownsAtFightStart");
        for (const id of this.listCues(this.listCueIds("readyCooldown"))) {
            if (isReadyGlowing || this.tracker.getRemaining(id) > READY_MARGIN) this.usedInCombat.add(id);
        }
    }

    /**
     * The important cooldowns of the class that are ready and on a button. In combat only the ones that have been on
     * cooldown in this fight; out of combat all of them (whether they show then is the When of their look, in combat only
     * by default, and for how long its glow time).
     * The cooldowns are read out of combat too, so the tracker knows the ones still running when a fight starts and the
     * client hides them.
     */
    findReadyCooldowns(): number[] {
        if (!this.settings.get("isReadyCooldownEnabled")) return [];
        const isInCombat = this.player.isInCombat();
        const ready: number[] = [];
        for (const id of this.listCues(this.listCueIds("readyCooldown"))) {
            if (this.tracker.getRemaining(id) > READY_MARGIN) {
                if (isInCombat) this.usedInCombat.add(id);
                continue;
            }
            // No cooldown in this form (Faerie Fire out of Bear Form): nothing to wait for
            if (!this.tracker.hasCooldownNow(id)) continue;
            if (!isInCombat || this.usedInCombat.has(id) || this.isGlowingWheneverReady(id)) ready.push(id);
        }
        return ready;
    }

    /**
     * A look whose When is not In combat (Always, Enemy targeted, Alert in town) glows whenever the cooldown is ready, in a
     * fight too: the rule of what was used in the fight is the one of In combat.
     */
    private isGlowingWheneverReady(spellId: number): boolean {
        return this.styles.getStyle("readyCooldown", spellId).when !== "inCombat";
    }

    /** Is the spell on its own cooldown (the global cooldown ignored)? A buff on cooldown cannot be cast again yet. */
    isOnCooldown(spellId: number): boolean {
        return this.tracker.getRemaining(spellId) > READY_MARGIN;
    }

    /** The procs of the class that the game says are usable now (Overpower and Revenge in any stance), and on a button. */
    findProcs(): number[] {
        if (!this.settings.get("isProcEnabled")) return [];
        return this.listCues(this.listCueIds("proc")).filter((id) => this.isProcUp(id) && this.tracker.getRemaining(id) <= READY_MARGIN);
    }

    /** The procs told by their spell, not by the game calling it usable. */
    private listSpellProcs() {
        return SPELL_PROC_CUES[this.player.getClassToken() ?? ""] ?? [];
    }

    /** The buffs of the procs told by their spell, for the Cooldown Manager to track. */
    listProcAuras(): number[] {
        const ids: number[] = [];
        for (const proc of this.listSpellProcs()) ids.push(...proc.auras);
        return ids;
    }

    /** What the icons of a proc's buffs say: up when one is, gone when all are out, undefined when one has no say. */
    private readProcIcons(auras: number[]): boolean | undefined {
        // No buff to ask: the spell tells
        if (auras.length === 0) return undefined;
        let isAnyUnknown = false;
        for (const id of auras) {
            const name = this.spells.getSpellName(id);
            const isUp = name !== undefined ? this.cooldownViewer.isBuffActive(name) : undefined;
            if (isUp === true) return true;
            if (isUp === undefined) isAnyUnknown = true;
        }
        return isAnyUnknown ? undefined : false;
    }

    private isProcUp(id: number): boolean {
        const name = this.spells.getSpellLabel(id);
        const spellProc = this.listSpellProcs().find((proc) => this.spells.getSpellLabel(proc.id) === name);
        if (spellProc !== undefined)
            return (
                this.readProcIcons(spellProc.auras) ??
                (spellProc.sign === "free" ? this.spellDetails.isFreeNow(id) : this.spellDetails.isInstantNow(id))
            );
        return this.spellDetails.readUsability(id).isUsable === true || this.stanceProcs.isOpen(id);
    }

    /**
     * The spells of the lists of a type (their wow-data IDs): for cooldowns the class's and the racials the player has
     * learned, for procs the class's.
     */
    listBuiltInIds(reminderType: AddableType): number[] {
        const classToken = this.player.getClassToken() ?? "";
        if (reminderType === "proc") return [...(PROC_CUES[classToken] ?? []), ...this.listSpellProcs().map((proc) => proc.id)];
        const racials = RACIAL_COOLDOWNS.filter((id) => this.spells.isLearned(this.addedSpells.getEffectiveId(id)));
        return (COOLDOWN_CUES[classToken] ?? []).concat(racials);
    }

    /** The spells of a type: the lists', and the ones the player added. */
    listCueIds(reminderType: AddableType): number[] {
        const kept = this.cueIds.get(reminderType);
        if (kept !== undefined) return kept;
        // Once each: a spell the player added may be on a list too (the Settings page cannot have two switches of one name)
        const ids: number[] = [];
        for (const id of this.listBuiltInIds(reminderType)) if (!ids.includes(id)) ids.push(id);
        for (const id of this.addedSpells.listAdded(reminderType)) if (!ids.includes(id)) ids.push(id);
        // Before the class is known (the first moments of the login) the list is not the class's yet
        if (this.player.getClassToken() !== undefined) this.cueIds.set(reminderType, ids);
        return ids;
    }

    @OnEvent("setting.changed", "spells.refreshed", "spells.invalidated", "spellbook.indexed")
    forgetCueIds(): void {
        for (const [reminderType] of this.cueIds) this.cueIds.delete(reminderType);
    }

    /** The cues that are learned, switched on, and on an action button, as the IDs the buttons hold. */
    private listCues(ids: number[]): number[] {
        const enabledSpells = this.settings.get("enabledSpells");
        const found: number[] = [];
        for (const id of ids) {
            const effectiveId = this.addedSpells.getEffectiveId(id);
            // A trinket's use spell is never learned: the item it is the use of counts
            const learned = this.spells.resolve(effectiveId) ?? (this.tracker.hasItemCooldown(effectiveId) ? effectiveId : undefined);
            if (learned === undefined || enabledSpells[String(id)] === false || !this.actionBars.isOnBars(learned)) continue;
            found.push(learned);
        }
        return found;
    }
}
