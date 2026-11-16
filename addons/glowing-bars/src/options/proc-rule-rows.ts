// The rows of the rules on the Proc rules tab, made once and reused: a rule's priority, condition, the ID it asks for (the
// buff's, the creature type's), where its buff stands with the Cooldown Manager, its result, group and switch. The addon's
// rules show their parts as words and can only be switched; the player's can be changed and taken out.
import { connectChoiceMenu } from "@wowkit/ui";
import type { CooldownViewerService, SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import { findHealthGroup, HIDDEN_KINDS, type ProcRule } from "../glows/proc-rules.interface";
import type { ProcRulesEditsService } from "../glows/proc-rules-edits.service";
import { describeCondition } from "./proc-rule-words";
import { CDM_TEXTS, findCdmStatus } from "./proc-rule-cdm";

/** A rule as the tab lists it: the addon's, or the player's at its place in their list. */
export interface RuleEntry {
    rule: ProcRule;
    ownIndex?: number;
}

interface RuleWidgets {
    frame: Frame;
    priority: EditBox;
    condition: FontString;
    id: FontString;
    cdm: FontString;
    result: Button;
    group: EditBox;
    /** The name a rule on the health with no group gets, grey in its empty box. */
    groupHint: FontString;
    isOn: CheckButton;
    builtIn: FontString;
    remove: Button;
    entry: RuleEntry | undefined;
}

export const RULE_HEIGHT = 28;
/** Where each column starts, from the tab's left. */
export const AT = { priority: 30, condition: 80, id: 262, cdm: 318, result: 398, group: 500, on: 612, end: 646 };

export class ProcRuleRows {
    private readonly rows: RuleWidgets[] = [];
    private used = 0;

    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly edits: ProcRulesEditsService,
        private readonly viewer: CooldownViewerService,
    ) {}

    /** The rows are laid out anew: the ones not shown this time are hidden at the end (see hideUnused). */
    startDraw(): void {
        this.used = 0;
    }

    hideUnused(): void {
        for (let i = this.used; i < this.rows.length; i++) this.rows[i]!.frame.Hide();
    }

    /** The next row, at `top` of `parent`, showing this rule; its controls work only while the rules are on. */
    show(parent: Frame, entry: RuleEntry, top: number, isOn: boolean): void {
        const row = this.rows[this.used] ?? this.create(parent);
        this.used += 1;
        row.entry = entry;
        row.frame.ClearAllPoints();
        row.frame.SetPoint("TOPLEFT", parent, "TOPLEFT", 0, -top);
        const { rule } = entry;
        const isOwn = entry.ownIndex !== undefined;
        const isHealth = HIDDEN_KINDS.includes(rule.kind);
        this.fillWords(row, rule, isHealth && isOwn);
        row.isOn.SetChecked(isOwn ? rule.isOff !== true : this.edits.isBuiltInOn(rule));
        row.builtIn.SetShown(!isOwn);
        row.remove.SetShown(isOwn);
        // The addon's rules are switched off and on only, a rule on the health can only light; nothing while the rules are off
        for (const control of [row.priority, row.group, row.remove]) this.setEnabled(control, isOn && isOwn);
        this.setEnabled(row.result, isOn && isOwn && !isHealth);
        this.setEnabled(row.isOn, isOn);
        row.frame.Show();
    }

    /** The words of the row: priority, condition, ID, the Cooldown Manager, result, group (or the name an own health rule's row gets). */
    private fillWords(row: RuleWidgets, rule: ProcRule, hasHint: boolean): void {
        row.priority.SetText(string.format("%d", rule.priority));
        row.condition.SetText(describeCondition(rule, this.locale, this.spells));
        const hasId = (rule.kind === "buff" || rule.kind === "targetType") && rule.value !== undefined;
        row.id.SetText(hasId ? string.format("%d", rule.value!) : "");
        row.cdm.SetText(this.describeCdm(rule));
        row.result.SetText(this.locale.getText(rule.result === "noGlow" ? "RULE_NO_GLOW" : "RULE_GLOW"));
        row.group.SetText(rule.group ?? "");
        row.groupHint.SetText(hasHint ? findHealthGroup(rule) : "");
        row.groupHint.SetShown(hasHint && (rule.group ?? "") === "");
    }

    /** Where a buff rule's buff stands with the Cooldown Manager, in its color; nothing for another rule. */
    private describeCdm(rule: ProcRule): string {
        if (rule.kind !== "buff" || rule.value === undefined) return "";
        const texts = CDM_TEXTS[findCdmStatus(rule.value, this.spells, this.viewer, this.settings)];
        return `${texts.color}${this.locale.getText(texts.label)}|r`;
    }

    private setEnabled(control: Button | EditBox | CheckButton, isEnabled: boolean): void {
        if (isEnabled) control.Enable();
        else control.Disable();
    }

    /** The rules are changed only while they are on (the controls are disabled too, this keeps it so for any click). */
    private changeOwn(row: RuleWidgets, change: Parameters<ProcRulesEditsService["changeRule"]>[1]): void {
        const index = row.entry?.ownIndex;
        if (index !== undefined && this.settings.get("shouldUseProcRules")) this.edits.changeRule(index, change);
    }

    private create(parent: Frame): RuleWidgets {
        const frame = CreateFrame("Frame", undefined, parent);
        frame.SetSize(AT.end + 40, RULE_HEIGHT);
        const priority = this.createBox(frame, AT.priority, 30, true);
        priority.SetMaxLetters(1);
        const condition = this.createText(frame, "GameFontHighlight", AT.condition, AT.id - AT.condition - 8);
        const group = this.createBox(frame, AT.group, 100, false);
        // In the box, over its empty field
        const groupHint = group.CreateFontString(undefined, "OVERLAY", "GameFontDisableSmall");
        groupHint.SetPoint("LEFT", group, "LEFT", 2, 0);
        groupHint.SetWidth(96);
        groupHint.SetJustifyH("LEFT");
        const result = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        result.SetSize(96, 22);
        result.SetPoint("LEFT", frame, "LEFT", AT.result, 0);
        const isOn = CreateFrame("CheckButton", undefined, frame, "UICheckButtonTemplate");
        isOn.SetSize(24, 24);
        isOn.SetPoint("LEFT", frame, "LEFT", AT.on, 0);
        const builtIn = this.createText(frame, "GameFontDisableSmall", AT.end, 60);
        builtIn.SetText(this.locale.getText("LABEL_RULE_BUILT_IN"));
        const remove = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        remove.SetSize(24, 22);
        remove.SetPoint("LEFT", frame, "LEFT", AT.end, 0);
        remove.SetText("X");
        const id = this.createText(frame, "GameFontHighlightSmall", AT.id, AT.cdm - AT.id - 4);
        const cdm = this.createText(frame, "GameFontHighlightSmall", AT.cdm, AT.result - AT.cdm - 4);
        const row: RuleWidgets = { frame, priority, condition, id, cdm, result, group, groupHint, isOn, builtIn, remove, entry: undefined };
        this.connectEdits(row);
        this.connectTips(row);
        this.rows.push(row);
        return row;
    }

    private connectEdits(row: RuleWidgets): void {
        const applyPriority = () => {
            const priority = tonumber(row.priority.GetText());
            if (priority !== undefined && priority >= 1 && priority !== row.entry?.rule.priority) this.changeOwn(row, { priority });
            row.priority.ClearFocus();
        };
        row.priority.SetScript("OnEnterPressed", applyPriority);
        row.priority.SetScript("OnEditFocusLost", applyPriority);
        const applyGroup = () => {
            const group = strtrim(row.group.GetText() ?? "");
            if (group !== (row.entry?.rule.group ?? "")) this.changeOwn(row, { group: group !== "" ? group : undefined });
            row.group.ClearFocus();
        };
        row.group.SetScript("OnEnterPressed", applyGroup);
        row.group.SetScript("OnEditFocusLost", applyGroup);
        row.group.SetScript("OnEditFocusGained", () => row.groupHint.Hide());
        connectChoiceMenu(row.result, () =>
            (["glow", "noGlow"] as const).map((result) => ({
                label: this.locale.getText(result === "glow" ? "RULE_GLOW" : "RULE_NO_GLOW"),
                isChosen: () => row.entry?.rule.result === result,
                choose: () => this.changeOwn(row, { result }),
            })),
        );
        row.isOn.SetScript("OnClick", () => this.applyRuleSwitch(row));
        row.remove.SetScript("OnClick", () => {
            const index = row.entry?.ownIndex;
            if (index !== undefined && this.settings.get("shouldUseProcRules")) this.edits.removeRule(index);
        });
    }

    private connectTips(row: RuleWidgets): void {
        const isHealth = () => row.entry !== undefined && HIDDEN_KINDS.includes(row.entry.rule.kind);
        row.group.SetScript("OnEnter", () => this.showTip(row.group, isHealth() ? "TIP_RULE_HEALTH_GROUP" : "TIP_RULE_GROUP"));
        row.result.SetScript("OnEnter", () => {
            if (isHealth()) this.showTip(row.result, "TIP_RULE_HEALTH_RESULT");
        });
        row.isOn.SetScript("OnEnter", () => {
            if (row.entry?.ownIndex === undefined) this.showTip(row.isOn, "TIP_RULE_BUILT_IN");
        });
        // A buff rule: how the buff is told, and where it stands with the Cooldown Manager
        row.frame.EnableMouse(true);
        row.frame.SetScript("OnEnter", () => {
            const rule = row.entry?.rule;
            if (rule?.kind !== "buff" || rule.value === undefined) return;
            this.showTip(row.frame, "TIP_RULE_BUFF");
            const status = findCdmStatus(rule.value, this.spells, this.viewer, this.settings);
            GameTooltip.AddLine(this.locale.getText(CDM_TEXTS[status].tip), 1, 0.82, 0, true);
            GameTooltip.Show();
        });
        for (const owner of [row.group, row.result, row.isOn, row.frame]) owner.SetScript("OnLeave", () => GameTooltip.Hide());
    }

    /** Switches the rule of the row off or on, the way its box shows; only while the rules are on. */
    private applyRuleSwitch(row: RuleWidgets): void {
        const entry = row.entry;
        if (entry === undefined || !this.settings.get("shouldUseProcRules")) return;
        const isOn = row.isOn.GetChecked();
        if (entry.ownIndex !== undefined) this.edits.changeRule(entry.ownIndex, { isOff: isOn ? undefined : true });
        else this.edits.setBuiltInOn(entry.rule, isOn);
    }

    private showTip(owner: Frame, text: TextKey): void {
        GameTooltip.SetOwner(owner, "ANCHOR_RIGHT");
        GameTooltip.SetText(this.locale.getText(text), 1, 1, 1, 1, true);
        GameTooltip.Show();
    }

    private createText(frame: Frame, font: string, x: number, width: number): FontString {
        const text = frame.CreateFontString(undefined, "OVERLAY", font);
        text.SetPoint("LEFT", frame, "LEFT", x, 0);
        text.SetWidth(width);
        text.SetJustifyH("LEFT");
        return text;
    }

    private createBox(frame: Frame, x: number, width: number, isNumeric: boolean): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(width, 20);
        box.SetPoint("LEFT", frame, "LEFT", x + 6, 0);
        box.SetAutoFocus(false);
        box.SetNumeric(isNumeric);
        box.SetScript("OnEscapePressed", () => box.ClearFocus());
        return box;
    }
}
