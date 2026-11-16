// Which spells glow because they are ready: the important cooldowns, and the procs (a spell the game says is usable now).
// In combat a cooldown counts only once it comes back: one that was never on cooldown in this fight is not news. How long
// it glows then is its glow time (a few seconds by default: one that waits for the right moment should not glow all the
// while).
import { OnEvent, OnGameEvent } from "@wowkit/core";
import type {
    ActionBarsService,
    AurasService,
    PlayerService,
    SpellDetailsService,
    SpellsService,
    CooldownViewerService,
    UnitsService,
} from "@wowkit/wow";
import type { AddonSettingsService, AddableType, CooldownType } from "../settings/settings.interface";
import { COOLDOWN_TYPES } from "../settings/settings.constants";
import type { AddedSpellsService } from "./added-spells.service";
import {
    COOLDOWN_CUES,
    LOW_HEALTH_CUES,
    PROC_CUES,
    RACIAL_COOLDOWNS,
    SPELL_PROC_CUES,
    TARGET_TYPE_CUES,
    UTILITY_COOLDOWNS,
    type SpellProcCue,
} from "./glow-cues.constants";
import { READY_MARGIN, type CooldownTrackerService } from "./cooldown-tracker.service";
import type { StanceProcsService } from "./stance-procs.service";
import type { ProcRulesService } from "./proc-rules.service";
import type { StyleService } from "../settings/style.service";

/** The list emptied, the same table: a tick makes as few new tables as it can. */
function clearList(list: number[]): number[] {
    for (let index = list.length; index > 0; index--) list.pop();
    return list;
}

export class GlowCuesService {
    /** The ready cooldowns of each type found due but on no button now (see listPagedAwayCooldowns). */
    private readonly pagedAway: { [cooldownType in CooldownType]: number[] } = { readyCooldown: [], utilityCooldown: [] };
    /** The cooldowns seen running since the login: only one of them glows as it is ready, a ready one was so before. */
    private readonly seenRunning = new LuaSet<number>();
    /** The ready cooldowns of each type never seen running since the login (see listReadyBefore). */
    private readonly readyBefore: { [cooldownType in CooldownType]: number[] } = { readyCooldown: [], utilityCooldown: [] };
    /** The cooldowns that have been running at some point of this fight (or ready as it started, if the player asked). */
    private usedInCombat = new LuaSet<number>();
    /** The spells of each type, kept until the settings or the spells change: every tick asks for them. */
    private readonly cueIds = new LuaMap<AddableType, number[]>();
    /** The answers of a tick, in the same lists each time: the ready cooldowns of each type, the procs, and the cues read. */
    private readonly readyFound: { [cooldownType in CooldownType]: number[] } = { readyCooldown: [], utilityCooldown: [] };
    private readonly procsFound: number[] = [];
    private readonly cuesFound: number[] = [];

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
        private readonly auras: AurasService,
        private readonly units: UnitsService,
        private readonly procRules: ProcRulesService,
    ) {}

    /**
     * A new fight: what was used in the last one is forgotten, and a cooldown that is running as it starts counts as used
     * in it (it glows when it is back), on a button or on a page of a bar not shown now. Read now, while the client may still
     * show the cooldowns. The ready ones whose When is In combat + start count too, on a button, as if they had just come back:
     * they glow right away, a reminder to use them. Not those of a page not shown: they would glow mid-fight, at its first sight.
     */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    startFight(): void {
        this.usedInCombat = new LuaSet<number>();
        for (const cooldownType of COOLDOWN_TYPES) {
            for (const id of this.listCues(this.listCueIds(cooldownType), false)) {
                const isReadyShown = this.styles.getStyle(cooldownType, id).when === "inCombatStart" && this.actionBars.isOnBars(id);
                if (isReadyShown || this.tracker.getRemaining(id) > READY_MARGIN) this.usedInCombat.add(id);
            }
        }
    }

    /**
     * The important cooldowns of the class that are ready and on a button. In combat only the ones that have been on
     * cooldown in this fight; out of combat all of them (whether they show then is the When of their look, in combat only
     * by default, and for how long its glow time).
     * The cooldowns are read out of combat too, so the tracker knows the ones still running when a fight starts and the
     * client hides them. Those of no button are read as well: a bar that pages (by stance, or a bar addon's by Shift or the
     * target) may show them later in the fight.
     */
    findReadyCooldowns(cooldownType: CooldownType): number[] {
        // The same list each time: a tick makes as few new tables as it can
        const pagedAway = clearList(this.pagedAway[cooldownType]);
        const readyBefore = clearList(this.readyBefore[cooldownType]);
        const ready = clearList(this.readyFound[cooldownType]);
        if (!this.settings.get(cooldownType === "readyCooldown" ? "isReadyCooldownEnabled" : "isUtilityCooldownEnabled")) return ready;
        const isInCombat = this.player.isInCombat();
        for (const id of this.listCues(this.listCueIds(cooldownType), false, clearList(this.cuesFound))) {
            if (this.checkRunning(id, isInCombat)) continue;
            if (!this.seenRunning.has(id)) readyBefore.push(id);
            // No cooldown in this form (Faerie Fire out of Bear Form): nothing to wait for
            if (!this.tracker.hasCooldownNow(id)) continue;
            if (!isInCombat || this.usedInCombat.has(id) || this.isGlowingWheneverReady(cooldownType, id)) {
                if (this.actionBars.isOnBars(id)) ready.push(id);
                else pagedAway.push(id);
            }
        }
        return ready;
    }

    /** Is the cooldown running? One running is noted: used in this fight, and seen running since the login. */
    private checkRunning(spellId: number, isInCombat: boolean): boolean {
        if (this.tracker.getRemaining(spellId) <= READY_MARGIN) return false;
        if (isInCombat) this.usedInCombat.add(spellId);
        this.seenRunning.add(spellId);
        return true;
    }

    /**
     * The ready cooldowns of the last look never seen running since the login: ready before it (a reload), they did not
     * just come back, and do not glow for it.
     */
    listReadyBefore(cooldownType: CooldownType): number[] {
        return this.readyBefore[cooldownType];
    }

    /** Is the spell the use of an item the player has equipped or on a bar (a trinket, the Hearthstone)? Never learned, it counts. */
    isItemUse(spellId: number): boolean {
        return this.tracker.hasItemCooldown(this.addedSpells.getEffectiveId(spellId));
    }

    /** The ready cooldowns the last look found due but on no button now: a page of a bar not shown (a stance, Shift). */
    listPagedAwayCooldowns(cooldownType: CooldownType): number[] {
        return this.pagedAway[cooldownType];
    }

    /**
     * A look whose When is not In combat (Always, Enemy targeted, Alert in town) glows whenever the cooldown is ready, in a
     * fight too: the rule of what was used in the fight is the one of In combat.
     */
    private isGlowingWheneverReady(cooldownType: CooldownType, spellId: number): boolean {
        const when = this.styles.getStyle(cooldownType, spellId).when;
        return when !== "inCombat" && when !== "inCombatStart";
    }

    /** Is the spell on its own cooldown (the global cooldown ignored)? A buff on cooldown cannot be cast again yet. */
    isOnCooldown(spellId: number): boolean {
        return this.tracker.getRemaining(spellId) > READY_MARGIN;
    }

    /** The procs of the class that the game says are usable now (Overpower and Revenge in any stance), and on a button. */
    findProcs(): number[] {
        const procs = clearList(this.procsFound);
        if (this.procRules.isOn()) this.procRules.forgetLit();
        if (!this.settings.get("isProcEnabled")) return procs;
        for (const id of this.listCues(this.listCueIds("proc"), true, clearList(this.cuesFound), true)) {
            // The proc rules (beta) when the player switched them on, else the built-in checks
            const isUp = this.procRules.isOn() ? this.procRules.isProcUp(id) : this.isProcUp(id);
            if (isUp && this.tracker.getRemaining(id) <= READY_MARGIN) procs.push(id);
        }
        return procs;
    }

    /** The class's last-resort defensives that glow at low health (their own service lights them, not the procs' look). */
    listLowHealthIds(): number[] {
        return LOW_HEALTH_CUES[this.player.getClassToken() ?? ""] ?? [];
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

    private isProcUp(id: number): boolean {
        const name = this.spells.getSpellLabel(id);
        const creatureTypes = TARGET_TYPE_CUES.find(([listId]) => this.spells.getSpellLabel(listId) === name)?.[1];
        if (creatureTypes !== undefined && !this.isTargetOfType(id, creatureTypes)) return false;
        const spellProc = this.listSpellProcs().find((proc) => this.spells.getSpellLabel(proc.id) === name);
        if (spellProc !== undefined) return this.isAnyBuffUp(spellProc.auras) || this.isSignShowing(id, spellProc);
        return this.spellDetails.readUsability(id).isUsable === true || this.stanceProcs.isOpen(id);
    }

    /**
     * Is the target one the spell hits (Exorcism: undead or demon)? A living enemy, then its type where the game shows it, else
     * the spell's range check. A dead one, or a friend of that type, is none.
     */
    private isTargetOfType(id: number, creatureTypes: number[]): boolean {
        if (!this.player.hasEnemyTarget()) return false;
        const typeId = this.units.getCreatureTypeId("target");
        if (typeId !== undefined) return creatureTypes.includes(typeId);
        return this.spellDetails.isInRange(id, "target") === true;
    }

    /** Is the spell free or instant now, by its proc (a proc with no such sign: no)? */
    private isSignShowing(id: number, spellProc: SpellProcCue): boolean {
        if (spellProc.sign === undefined) return false;
        return spellProc.sign === "free" ? this.spellDetails.isFreeNow(id) : this.spellDetails.isInstantNow(id);
    }

    /** Is one of the proc's buffs on the player (by its aura, or its icon in the Cooldown Manager)? */
    private isAnyBuffUp(buffs: number[]): boolean {
        for (const buff of buffs) if (this.isBuffUp(buff)) return true;
        return false;
    }

    /**
     * Is the buff on the player: by the aura, or by its icon in the Cooldown Manager (the game hides the aura in a fight).
     * Either one saying up is enough: an icon follows only its entry's exact IDs, so its "out" cannot overrule the aura.
     */
    private isBuffUp(buffId: number): boolean {
        if (this.auras.readPlayerAura(buffId)?.isFound === true) return true;
        const name = this.spells.getSpellName(buffId);
        return name !== undefined && this.cooldownViewer.isBuffActive(name) === true;
    }

    /**
     * The spells of the lists of a type (their wow-data IDs): for cooldowns the class's and the racials the player has
     * learned, for the utility cooldowns the ones of between fights the player has (learned, or on a bar), for procs the class's.
     */
    listBuiltInIds(reminderType: AddableType): number[] {
        const classToken = this.player.getClassToken() ?? "";
        if (reminderType === "proc" && this.procRules.isOn()) return this.procRules.listSpellIds();
        if (reminderType === "proc") return [...(PROC_CUES[classToken] ?? []), ...this.listSpellProcs().map((proc) => proc.id)];
        const isLearned = (id: number): boolean => this.spells.isLearned(this.addedSpells.getEffectiveId(id));
        // The Hearthstone is an item: it counts on a bar
        if (reminderType === "utilityCooldown") return UTILITY_COOLDOWNS.filter((id) => isLearned(id) || this.tracker.hasItemCooldown(id));
        return (COOLDOWN_CUES[classToken] ?? []).concat(RACIAL_COOLDOWNS.filter((id) => isLearned(id)));
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

    @OnEvent("setting.changed", "spells.refreshed", "spells.invalidated", "spellbook.indexed", "bars.mapped")
    forgetCueIds(): void {
        for (const [reminderType] of this.cueIds) this.cueIds.delete(reminderType);
    }

    /**
     * Is the cue switched off on its row? A proc of the rules with no row of its own on the Procs tab (its rules all have a
     * group) has no switch of its own: its groups' alone count.
     */
    private isCueSwitchedOff(id: number, isProc: boolean, enabledSpells: { [key: string]: boolean | undefined }): boolean {
        return enabledSpells[String(id)] === false && (!isProc || this.procRules.hasOwnRow(id));
    }
    /**
     * The cues that are learned, switched on, and on an action button (unless `isOnBarsOnly` is false), as the IDs the buttons
     * hold; into `found`, a list a tick reuses, or a new one.
     */
    private listCues(ids: number[], isOnBarsOnly = true, found: number[] = [], isProc = false): number[] {
        const enabledSpells = this.settings.get("enabledSpells");
        for (const id of ids) {
            const effectiveId = this.addedSpells.getEffectiveId(id);
            // A trinket's use spell is never learned: the item it is the use of counts
            const learned = this.spells.resolve(effectiveId) ?? (this.tracker.hasItemCooldown(effectiveId) ? effectiveId : undefined);
            if (learned === undefined || this.isCueSwitchedOff(id, isProc, enabledSpells)) continue;
            if (isOnBarsOnly && !this.actionBars.isOnBars(learned)) continue;
            found.push(learned);
        }
        return found;
    }
}
