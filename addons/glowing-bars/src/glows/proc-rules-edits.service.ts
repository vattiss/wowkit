// The changes the table makes to the proc rules: the class's own rules can only be switched off and on; the player's are
// added, changed (priority, result, group), switched off and on, and taken out. Each change saves a new list, so the
// engine and the table hear of it ("setting.changed").
import type { PlayerService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { BUILT_IN_PROC_RULES } from "./proc-rules.constants";
import { buildProcRuleKey, type BuiltInProcRule, type ProcRule } from "./proc-rules.interface";

/** The fields of a rule of the player's that the table changes. */
export type ChangeableKey = "priority" | "result" | "group" | "isOff";

export class ProcRulesEditsService {
    constructor(
        private readonly settings: AddonSettingsService,
        private readonly player: PlayerService,
    ) {}

    /** The class's own rules, the ones switched off too. */
    listBuiltIn(): BuiltInProcRule[] {
        return BUILT_IN_PROC_RULES[this.player.getClassToken() ?? ""] ?? [];
    }

    /** The player's rules, in the order they were added (a rule is changed and taken out by its place here). */
    listOwn(): ProcRule[] {
        return this.settings.get("procRules");
    }

    isBuiltInOn(rule: ProcRule): boolean {
        return this.settings.get("disabledProcRules")[buildProcRuleKey(rule)] !== true;
    }

    setBuiltInOn(rule: ProcRule, isOn: boolean): void {
        const disabled = { ...this.settings.get("disabledProcRules") };
        disabled[buildProcRuleKey(rule)] = isOn ? undefined : true;
        this.settings.change("disabledProcRules", disabled);
    }

    addRule(rule: ProcRule): void {
        this.settings.change("procRules", [...this.listOwn(), rule]);
    }

    /** Changes the player's rule at `index`: its priority, result, group, or whether it is on. */
    /**
     * One field of a rule of the player's. Set by name: in Lua a field merged in as nil is no field at all, so a merge could
     * never clear the group, nor switch a rule back on.
     */
    changeRule<Key extends ChangeableKey>(index: number, key: Key, value: ProcRule[Key]): void {
        const rules = this.listOwn().map((rule, at) => {
            if (at !== index) return rule;
            const changed = { ...rule };
            changed[key] = value;
            return changed;
        });
        this.settings.change("procRules", rules);
    }

    removeRule(index: number): void {
        this.settings.change(
            "procRules",
            this.listOwn().filter((_rule, at) => at !== index),
        );
    }
}
