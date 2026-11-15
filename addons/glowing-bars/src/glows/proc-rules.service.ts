// The engine of the proc rules (beta, "Use advanced proc rules"): the addon's own rules of the class, but those the player
// switched off, and the player's own. Each spell goes by its rules from priority 1 up: the first number at which a rule
// holds decides, a glowing one winning over a keeping-dark one of the same number (see proc-rules.interface.ts). The
// conditions only the game knows (health) are left to their own services.
import { OnEvent } from "@wowkit/core";
import type { AurasService, CooldownViewerService, PlayerService, SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { BUILT_IN_PROC_RULES } from "./proc-rules.constants";
import { buildProcRuleKey, HIDDEN_KINDS, type BuiltInProcRule, type ProcConditionKind } from "./proc-rules.interface";
import type { StanceProcsService } from "./stance-procs.service";

/** What a condition says of a spell now: holds, does not, or the game does not tell (undefined). */
type Check = (this: void, spellId: number, rule: BuiltInProcRule) => boolean | undefined;

export class ProcRulesService {
    /** The rules of each spell by its name, sorted by priority: worked out again when a setting or the spells change. */
    private rulesByName: LuaMap<string, BuiltInProcRule[]> | undefined;
    private spellIds: number[] | undefined;
    /** The group of the rule that lit each spell at the last look; none: the spell's own row. */
    private readonly litGroups = new LuaMap<number, string>();
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
    ) {
        this.checks = {
            usable: (spellId) => this.isUsable(spellId),
            buff: (_spellId, rule) => this.isBuffUp(rule.value ?? 0),
            buffGone: (_spellId, rule) => this.isBuffSurelyGone(rule.value ?? 0),
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
    }

    /** Every rule that counts: the class's own but those switched off, and the player's. */
    listRules(): BuiltInProcRule[] {
        const disabled = this.settings.get("disabledProcRules");
        const builtIn = BUILT_IN_PROC_RULES[this.player.getClassToken() ?? ""] ?? [];
        return [...builtIn.filter((rule) => disabled[buildProcRuleKey(rule)] !== true), ...this.settings.get("procRules")];
    }

    /** The spells the rules can light by the ticks' engine: those with a rule whose answer the addon can know. */
    listSpellIds(): number[] {
        if (this.spellIds !== undefined) return this.spellIds;
        const ids: number[] = [];
        for (const rule of this.listRules()) if (!HIDDEN_KINDS.includes(rule.kind) && !ids.includes(rule.spellId)) ids.push(rule.spellId);
        if (this.player.getClassToken() !== undefined) this.spellIds = ids;
        return ids;
    }

    /** Is the proc up by its rules? A spell with no rule (a proc added before the rules) goes by the game calling it usable. */
    isProcUp(spellId: number): boolean {
        this.litGroups.delete(spellId);
        const rules = this.findRulesOf(spellId);
        if (rules === undefined) return this.isUsable(spellId);
        const lit = this.findLitRule(spellId, rules);
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
            if (this.checks[rule.kind]?.(spellId, rule) !== true) continue;
            if (rule.result === "noGlow") isKeptDark = true;
            else lit ??= rule;
        }
        return lit;
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
                const list = byName.get(name) ?? [];
                byName.set(name, list);
                list.push(rule);
            }
            for (const [, list] of byName) list.sort((a, b) => a.priority - b.priority);
            this.rulesByName = byName;
        }
        return this.rulesByName.get(this.spells.getSpellLabel(spellId) ?? string.format("%d", spellId));
    }

    private isUsable(spellId: number): boolean {
        return this.spellDetails.readUsability(spellId).isUsable === true;
    }

    /** Is the buff on the player: by its aura, else its icon in the Cooldown Manager; out of a fight no aura is no buff. */
    private isBuffUp(buffId: number): boolean | undefined {
        if (this.auras.readPlayerAura(buffId)?.isFound === true) return true;
        const name = this.spells.getSpellName(buffId);
        const isIconUp = name !== undefined ? this.cooldownViewer.isBuffActive(name) : undefined;
        if (isIconUp !== undefined) return isIconUp;
        return this.player.isInCombat() ? undefined : false;
    }

    /** Is the buff surely not on the player: its icon in the Cooldown Manager is out? No aura is no proof: the game may hide it. */
    private isBuffSurelyGone(buffId: number): boolean | undefined {
        if (this.auras.readPlayerAura(buffId)?.isFound === true) return false;
        const name = this.spells.getSpellName(buffId);
        const isIconUp = name !== undefined ? this.cooldownViewer.isBuffActive(name) : undefined;
        return isIconUp === undefined ? undefined : !isIconUp;
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
