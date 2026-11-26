// The engine of the proc rules (beta, "Use advanced proc rules"): the addon's own rules of the class, but those the player
// switched off, and the player's own. Each spell goes by its rules from priority 1 up: the first number at which a rule
// holds decides, a glowing one winning over a keeping-dark one of the same number (see proc-rules.interface.ts). The
// conditions only the game knows (health) are left to their own services.
import { OnEvent } from "@wowkit/core";
import {
    type AurasService,
    type CooldownViewerService,
    type PlayerService,
    type SpellDetailsService,
    type SpellsService,
    type UnitsService,
    buildNameKey,
} from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { BUILT_IN_PROC_RULES } from "./proc-rules.constants";
import {
    buildGroupSwitchKey,
    buildProcRuleKey,
    HIDDEN_KINDS,
    type BuiltInProcRule,
    type ProcConditionKind,
    type ProcRule,
} from "./proc-rules.interface";
import type { StanceProcsService } from "./stance-procs.service";
import type { BuffStateService } from "../character/buff-state.service";

/** What a condition says of a spell now: holds, does not, or the game does not tell (undefined). */
type Check = (this: void, spellId: number, rule: BuiltInProcRule) => boolean | undefined;

export class ProcRulesService {
    /** The rules of each spell by its name, sorted by priority: worked out again when a setting or the spells change. */
    private rulesByName: LuaMap<string, BuiltInProcRule[]> | undefined;
    private spellIds: number[] | undefined;
    /** The spells with a rule of no group, whose own row on the Procs tab shows; worked out again with the rules. */
    private plainRowIds: LuaSet<number> | undefined;
    /** The group of the rule that lit each spell at the last look; none: the spell's own row. */
    private readonly litGroups = new LuaMap<number, string>();
    /** The spells a rule whose answer the addon knows lit at the last look: a rule on the health then has nothing to add. */
    private readonly litSpells = new LuaSet<number>();
    /** The player's rules on the health that are on, worked out with the others. */
    private ownHealthRules: ProcRule[] | undefined;
    private readonly checks: { [kind in ProcConditionKind]?: Check };

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly units: UnitsService,
        private readonly spellDetails: SpellDetailsService,
        private readonly stanceProcs: StanceProcsService,
        private readonly cooldownViewer: CooldownViewerService,
        private readonly auras: AurasService,
        private readonly buffState: BuffStateService,
    ) {
        this.checks = {
            usable: (spellId) => this.isUsable(spellId),
            buff: (_spellId, rule) => this.isBuffUp(rule.value ?? 0, rule.isOwn === true),
            targetType: (spellId, rule) => this.isTargetOfType(spellId, rule),
            afterBlock: () => this.stanceProcs.isAfterAvoided("BLOCK"),
            afterDodge: () => this.stanceProcs.isAfterAvoided("DODGE"),
            afterParry: () => this.stanceProcs.isAfterAvoided("PARRY"),
            targetDodged: () => this.stanceProcs.hasTargetDodged(),
            free: (spellId) => this.spellDetails.isFreeNow(spellId),
            instant: (spellId) => this.spellDetails.isInstantNow(spellId),
        };
    }

    /** Does the new engine decide the procs (the player switched it on)? */
    isOn(): boolean {
        return this.settings.get("shouldUseProcRules");
    }

    @OnEvent("setting.changed", "spells.refreshed", "spells.invalidated", "spellbook.indexed")
    forgetRules(): void {
        this.rulesByName = undefined;
        this.spellIds = undefined;
        this.plainRowIds = undefined;
        this.ownHealthRules = undefined;
    }

    /** Every rule that counts: the class's own but those switched off, and the player's. */
    listRules(): BuiltInProcRule[] {
        const disabled = this.settings.get("disabledProcRules");
        const builtIn = BUILT_IN_PROC_RULES[this.player.getClassToken() ?? ""] ?? [];
        const own = this.settings
            .get("procRules")
            .filter((rule) => rule.isOff !== true)
            .map((rule) => ({ ...rule, isOwn: true }));
        return [...builtIn.filter((rule) => disabled[buildProcRuleKey(rule)] !== true), ...own];
    }

    /** The spells the rules can light by the ticks' engine: those with a rule whose answer the addon can know. */
    listSpellIds(): number[] {
        if (this.spellIds !== undefined) return this.spellIds;
        const ids: number[] = [];
        for (const rule of this.listRules()) if (!HIDDEN_KINDS.includes(rule.kind) && !ids.includes(rule.spellId)) ids.push(rule.spellId);
        if (this.player.getClassToken() !== undefined) this.spellIds = ids;
        return ids;
    }

    /**
     * Has the spell a rule of no group (not one on the health, which has a row of its own)? Only then its own row on the Procs
     * tab shows, with its look and switch; the rows of its groups do the rest.
     */
    hasPlainRow(spellId: number): boolean {
        if (this.plainRowIds === undefined) {
            const ids = new LuaSet<number>();
            for (const rule of this.listRules()) if (rule.group === undefined && !HIDDEN_KINDS.includes(rule.kind)) ids.add(rule.spellId);
            if (this.player.getClassToken() !== undefined) this.plainRowIds = ids;
            return ids.has(spellId);
        }
        return this.plainRowIds.has(spellId);
    }

    /** Are the rows of its groups all the spell's rules have (it has rules, each of a group)? Its own row is then hidden. */
    hasOnlyGroupRows(spellId: number): boolean {
        return this.listSpellIds().includes(spellId) && !this.hasPlainRow(spellId);
    }

    /** Does the spell's own row show on the Procs tab: always without the rules, with them while it has a rule of no group (or no rule)? */
    hasOwnRow(spellId: number): boolean {
        return !this.isOn() || !this.hasOnlyGroupRows(spellId);
    }
    /** A new look at the procs: what was lit at the last one is forgotten, a spell not looked at again is lit by nothing. */
    forgetLit(): void {
        for (const [spellId] of this.litGroups) this.litGroups.delete(spellId);
        for (const spellId of this.litSpells) this.litSpells.delete(spellId);
    }

    /** Is the proc up by its rules? A spell with no rule (a proc added before the rules) goes by the game calling it usable. */
    isProcUp(spellId: number): boolean {
        this.litGroups.delete(spellId);
        this.litSpells.delete(spellId);
        const rules = this.findRulesOf(spellId);
        if (rules === undefined) return this.isUsable(spellId);
        const lit = this.findLitRule(spellId, rules);
        if (lit !== undefined) this.litSpells.add(spellId);
        if (lit?.group !== undefined && lit.group !== "") this.litGroups.set(spellId, lit.group);
        return lit !== undefined;
    }

    /** The rule that lights the spell: the first Glow that holds at the first number where any rule holds; none: it stays dark. */
    private findLitRule(spellId: number, rules: BuiltInProcRule[]): BuiltInProcRule | undefined {
        let level = 0;
        let lit: BuiltInProcRule | undefined;
        let isKeptDark = false;
        for (const rule of rules) {
            if (rule.priority !== level) {
                if (lit !== undefined || isKeptDark) break;
                level = rule.priority;
            }
            // A group switched off on the Procs tab: its rules hold for nothing
            if (rule.switchKey !== undefined && this.settings.get("enabledSpells")[rule.switchKey] === false) continue;
            if (this.checks[rule.kind]?.(spellId, rule) !== true) continue;
            if (rule.result === "noGlow") isKeptDark = true;
            else lit ??= rule;
        }
        return lit;
    }

    /** The buffs the player's rules that are on ask for (up or gone), for the Cooldown Manager to track; none while the rules are off. */
    listRuleBuffs(): number[] {
        if (!this.isOn()) return [];
        const buffs: number[] = [];
        for (const rule of this.settings.get("procRules")) {
            if (rule.kind === "buff" && rule.isOff !== true && rule.value !== undefined) buffs.push(rule.value);
        }
        return buffs;
    }

    /** Did a rule whose answer the addon knows light the spell at the last look? */
    isLitNow(spellId: number): boolean {
        return this.litSpells.has(spellId);
    }

    /** The player's rules on the health that are on: lit by a service of their own, as only the game knows the health. */
    listOwnHealthRules(): ProcRule[] {
        this.ownHealthRules ??= this.settings.get("procRules").filter((rule) => rule.isOff !== true && HIDDEN_KINDS.includes(rule.kind));
        return this.ownHealthRules;
    }

    /** The group of the rule that lit the spell at the last look: its look is that row's. */
    findLitGroup(spellId: number): string | undefined {
        return this.litGroups.get(spellId);
    }

    /** The rules of the spell (any rank, by its name), sorted by priority; undefined for a spell with none. */
    private findRulesOf(spellId: number): BuiltInProcRule[] | undefined {
        if (this.rulesByName === undefined) {
            const byName = new LuaMap<string, BuiltInProcRule[]>();
            for (const rule of this.listRules()) {
                const name = this.spells.getSpellLabel(rule.spellId) ?? string.format("%d", rule.spellId);
                // By the name's key, so every rank (however the client writes it) is one; the switch keeps the name
                const list = byName.get(buildNameKey(name)) ?? [];
                byName.set(buildNameKey(name), list);
                const switchKey = rule.group !== undefined ? buildGroupSwitchKey(name, rule.group) : undefined;
                list.push({ ...rule, switchKey });
            }
            for (const [, list] of byName) list.sort((a, b) => a.priority - b.priority);
            this.rulesByName = byName;
        }
        return this.rulesByName.get(buildNameKey(this.spells.getSpellLabel(spellId) ?? string.format("%d", spellId)));
    }

    private isUsable(spellId: number): boolean {
        return this.spellDetails.readUsability(spellId).isUsable === true;
    }

    /**
     * Is the buff on the player: by its aura, else its icon in the Cooldown Manager; for a rule of the player's, also by the
     * addon's memory of it (cast, or seen before the fight hid it), as a missing buff is told. Out of a fight no aura is no buff.
     */
    private isBuffUp(buffId: number, isOwn = false): boolean | undefined {
        // Asked every time, for the memory to keep up (it reads the aura, and remembers it for the fight); it counts last
        const isRemembered = isOwn && this.buffState.hasAura(buffId);
        if (this.auras.readPlayerAura(buffId)?.isFound === true) return true;
        // The icon in the Cooldown Manager, where it has a say, over the memory: a buff can end before its time
        const name = this.spells.getSpellName(buffId);
        const isIconUp = name !== undefined ? this.cooldownViewer.isBuffActive(name) : undefined;
        if (isIconUp !== undefined) return isIconUp;
        if (isRemembered) return true;
        return this.player.isInCombat() ? undefined : false;
    }

    /**
     * A living enemy of the rule's creature type is targeted, and the spell can be cast. Where the game hides the type, the
     * spell's range check stands in for a rule that says so (a spell that hits nothing else); else nobody can tell.
     */
    private isTargetOfType(spellId: number, rule: BuiltInProcRule): boolean | undefined {
        if (!this.player.hasEnemyTarget()) return false;
        const typeId = this.units.getCreatureTypeId("target");
        if (typeId !== undefined) return typeId === rule.value && this.isUsable(spellId);
        if (rule.isRangeFallback !== true) return undefined;
        return this.spellDetails.isInRange(spellId, "target") === true && this.isUsable(spellId);
    }
}
