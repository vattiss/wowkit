// The Proc rules tab of the table of looks (beta): the switch of the new engine at the top, then the rules of each spell under
// its name, sorted by priority, and the row that adds one. The addon's own rules can only be switched off and on; the
// player's can be changed (priority, result, group) and taken out. While the switch is off, the rules are faded and do
// nothing. The glows' looks stay on the Procs tab, a row for each spell and each group.
import type { SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import { HIDDEN_KINDS, type ProcRule } from "../glows/proc-rules.interface";
import type { ProcRulesEditsService } from "../glows/proc-rules-edits.service";
import type { StyleWindowService } from "./style-window.service";
import type { ProcRulesAddRow } from "./proc-rules-add-row";
import { describeCondition } from "./proc-rule-words";
import { connectChoiceMenu } from "@wowkit/ui";

/** A rule as the tab lists it: the addon's, or the player's at its place in their list. */
interface RuleEntry {
    rule: ProcRule;
    ownIndex?: number;
}

/** The rules of one spell. */
interface SpellRules {
    spellId: number;
    label: string;
    entries: RuleEntry[];
}

interface RuleWidgets {
    frame: Frame;
    priority: EditBox;
    condition: FontString;
    result: Button;
    group: EditBox;
    isOn: CheckButton;
    builtIn: FontString;
    remove: Button;
    /** The rule the widgets show now. */
    entry: RuleEntry | undefined;
}

const HEADING_HEIGHT = 26;
const RULE_HEIGHT = 28;
const FADED_ALPHA = 0.45; /** The height of the switch and its words. */
const SWITCH_HEIGHT = 56;
/** Where the rules start: under the switch, the order's line, the unlearned switch and the columns' headers. */
const RULES_TOP = SWITCH_HEIGHT + 64;

/** Where each column starts, from the tab's left. */
const AT = { priority: 30, condition: 80, result: 320, group: 430, on: 552, end: 590 };
const HEADERS: [x: number, text: TextKey][] = [
    [AT.priority, "HDR_RULE_PRIORITY"],
    [AT.condition, "HDR_RULE_CONDITION"],
    [AT.result, "HDR_RULE_RESULT"],
    [AT.group, "HDR_RULE_GROUP"],
    [AT.on, "HDR_RULE_ON"],
];

export class ProcRulesTab {
    private holder: Frame | undefined;
    private rulesFrame: Frame | undefined;
    private switchBox: CheckButton | undefined;
    private unlearnedBox: CheckButton | undefined;
    private readonly headings: { frame: Frame; icon: Texture; name: FontString }[] = [];
    private readonly rows: RuleWidgets[] = [];

    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly edits: ProcRulesEditsService,
        private readonly windows: StyleWindowService,
        private readonly addRow: ProcRulesAddRow,
    ) {}

    /** The tab from `top`, this wide, `left` in; returns where it ends. */
    draw(content: Frame, top: number, width: number, left: number): number {
        const holder = this.holder ?? this.create(content);
        holder.ClearAllPoints();
        holder.SetPoint("TOPLEFT", content, "TOPLEFT", left, -top);
        holder.SetWidth(width);
        const isOn = this.settings.get("shouldUseProcRules");
        this.switchBox!.SetChecked(isOn);
        this.unlearnedBox!.SetChecked(this.windows.isUnlearnedShown("procRules"));
        const rulesFrame = this.rulesFrame!;
        rulesFrame.SetAlpha(isOn ? 1 : FADED_ALPHA);
        let y = 0;
        let usedHeadings = 0;
        let usedRows = 0;
        for (const spell of this.listSpellRules()) {
            this.showHeading(usedHeadings++, spell, y);
            y += HEADING_HEIGHT;
            for (const entry of spell.entries) {
                this.showRule(usedRows++, entry, y, isOn);
                y += RULE_HEIGHT;
            }
        }
        for (let i = usedHeadings; i < this.headings.length; i++) this.headings[i]!.frame.Hide();
        for (let i = usedRows; i < this.rows.length; i++) this.rows[i]!.frame.Hide();
        y = this.addRow.draw(rulesFrame, y + 10, isOn);
        rulesFrame.SetSize(width, y);
        holder.SetHeight(RULES_TOP + y);
        holder.Show();
        return top + RULES_TOP + y;
    }

    hide(): void {
        this.holder?.Hide();
    }

    /** The spells and their rules, by name, each spell's by priority, the addon's first; the player's spells always, the class's while learned unless asked. */
    private listSpellRules(): SpellRules[] {
        const bySpell = new LuaMap<string, SpellRules>();
        const isUnlearnedShown = this.windows.isUnlearnedShown("procRules");
        const add = (entry: RuleEntry) => {
            if (entry.ownIndex === undefined && !isUnlearnedShown && !this.spells.isLearned(entry.rule.spellId)) return;
            const label = this.spells.getSpellLabel(entry.rule.spellId) ?? string.format("%d", entry.rule.spellId);
            const spell = bySpell.get(label) ?? { spellId: entry.rule.spellId, label, entries: [] };
            bySpell.set(label, spell);
            spell.entries.push(entry);
        };
        for (const rule of this.edits.listBuiltIn()) add({ rule });
        this.edits.listOwn().forEach((rule, ownIndex) => add({ rule, ownIndex }));
        const spells: SpellRules[] = [];
        for (const [, spell] of bySpell) {
            spell.entries.sort((a, b) => a.rule.priority - b.rule.priority || (a.ownIndex ?? -1) - (b.ownIndex ?? -1));
            spells.push(spell);
        }
        spells.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
        return spells;
    }

    private showHeading(index: number, spell: SpellRules, top: number): void {
        let heading = this.headings[index];
        if (heading === undefined) {
            const frame = CreateFrame("Frame", undefined, this.rulesFrame);
            frame.SetSize(AT.end, HEADING_HEIGHT);
            const icon = frame.CreateTexture(undefined, "ARTWORK");
            icon.SetSize(20, 20);
            icon.SetPoint("LEFT", frame, "LEFT", 0, 0);
            const name = frame.CreateFontString(undefined, "OVERLAY", "GameFontNormal");
            name.SetPoint("LEFT", frame, "LEFT", 26, 0);
            heading = { frame, icon, name };
            this.headings.push(heading);
        }
        heading.frame.ClearAllPoints();
        heading.frame.SetPoint("TOPLEFT", this.rulesFrame!, "TOPLEFT", 0, -top);
        // The client takes an icon's file ID as well as a path; the typing knows only the path
        heading.icon.SetTexture(this.spells.getSpellInfo(spell.spellId)?.iconID as unknown as string);
        heading.name.SetText(spell.label);
        heading.frame.SetAlpha(this.spells.isLearned(spell.spellId) ? 1 : 0.5);
        heading.frame.Show();
    }

    /** A rule's row: the addon's shows its parts as words, the player's as boxes and a list to change. */
    private showRule(index: number, entry: RuleEntry, top: number, isOn: boolean): void {
        const row = this.rows[index] ?? this.createRule();
        row.entry = entry;
        row.frame.ClearAllPoints();
        row.frame.SetPoint("TOPLEFT", this.rulesFrame!, "TOPLEFT", 0, -top);
        const { rule } = entry;
        const isOwn = entry.ownIndex !== undefined;
        row.priority.SetText(string.format("%d", rule.priority));
        // A buff of the player's rule that only the Cooldown Manager can tell in a fight, with no access to it: marked, its tip says why
        const isUntold = isOwn && this.isBuffUntold(rule);
        row.condition.SetText(describeCondition(rule, this.locale, this.spells) + (isUntold ? " *" : ""));
        row.result.SetText(this.locale.getText(rule.result === "noGlow" ? "RULE_NO_GLOW" : "RULE_GLOW"));
        row.group.SetText(rule.group ?? "");
        row.isOn.SetChecked(isOwn ? rule.isOff !== true : this.edits.isBuiltInOn(rule));
        row.builtIn.SetShown(!isOwn);
        row.remove.SetShown(isOwn);
        // The addon's rules are switched off and on only; nothing while the rules are off
        for (const control of [row.priority, row.group, row.remove]) this.setEnabled(control, isOn && isOwn);
        // A rule on the health can only light its spell
        this.setEnabled(row.result, isOn && isOwn && !HIDDEN_KINDS.includes(rule.kind));
        this.setEnabled(row.isOn, isOn);
        row.frame.Show();
    }

    /** A buff rule whose buff the game hides in a fight, while the addon may not have the Cooldown Manager track it. */
    private isBuffUntold(rule: ProcRule): boolean {
        return rule.kind === "buff" && this.settings.get("cooldownManagerAccess") !== "full";
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

    private createRule(): RuleWidgets {
        const frame = CreateFrame("Frame", undefined, this.rulesFrame);
        frame.SetSize(AT.end + 40, RULE_HEIGHT);
        const priority = this.createBox(frame, AT.priority, 30, true);
        priority.SetMaxLetters(1);
        const condition = frame.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        condition.SetPoint("LEFT", frame, "LEFT", AT.condition, 0);
        condition.SetWidth(AT.result - AT.condition - 8);
        condition.SetJustifyH("LEFT");
        const result = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        result.SetSize(96, 22);
        result.SetPoint("LEFT", frame, "LEFT", AT.result, 0);
        const group = this.createBox(frame, AT.group, 100, false);
        const isOn = CreateFrame("CheckButton", undefined, frame, "UICheckButtonTemplate");
        isOn.SetSize(24, 24);
        isOn.SetPoint("LEFT", frame, "LEFT", AT.on, 0);
        const builtIn = frame.CreateFontString(undefined, "OVERLAY", "GameFontDisableSmall");
        builtIn.SetPoint("LEFT", frame, "LEFT", AT.end, 0);
        builtIn.SetText(this.locale.getText("LABEL_RULE_BUILT_IN"));
        const remove = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        remove.SetSize(24, 22);
        remove.SetPoint("LEFT", frame, "LEFT", AT.end, 0);
        remove.SetText("X");
        const row: RuleWidgets = { frame, priority, condition, result, group, isOn, builtIn, remove, entry: undefined };
        this.connectRule(row);
        this.rows.push(row);
        return row;
    }

    private connectRule(row: RuleWidgets): void {
        const applyPriority = () => {
            const priority = tonumber(row.priority.GetText());
            if (priority !== undefined && priority >= 1 && priority !== row.entry?.rule.priority) this.changeOwn(row, { priority });
            row.priority.ClearFocus();
        };
        row.priority.SetScript("OnEnterPressed", applyPriority);
        row.priority.SetScript("OnEditFocusLost", applyPriority);
        const applyGroup = () => {
            const group = strtrim(row.group.GetText());
            if (group !== (row.entry?.rule.group ?? "")) this.changeOwn(row, { group: group !== "" ? group : undefined });
            row.group.ClearFocus();
        };
        row.group.SetScript("OnEnterPressed", applyGroup);
        row.group.SetScript("OnEditFocusLost", applyGroup);
        row.group.SetScript("OnEnter", () => this.showTip(row.group, "TIP_RULE_GROUP"));
        row.group.SetScript("OnLeave", () => GameTooltip.Hide());
        connectChoiceMenu(row.result, () =>
            (["glow", "noGlow"] as const).map((result) => ({
                label: this.locale.getText(result === "glow" ? "RULE_GLOW" : "RULE_NO_GLOW"),
                isChosen: () => row.entry?.rule.result === result,
                choose: () => this.changeOwn(row, { result }),
            })),
        );
        row.isOn.SetScript("OnClick", () => this.applyRuleSwitch(row));
        row.result.SetScript("OnEnter", () => {
            if (row.entry !== undefined && HIDDEN_KINDS.includes(row.entry.rule.kind)) this.showTip(row.result, "TIP_RULE_HEALTH_RESULT");
        });
        row.result.SetScript("OnLeave", () => GameTooltip.Hide());
        row.frame.EnableMouse(true);
        row.frame.SetScript("OnEnter", () => {
            if (row.entry?.ownIndex !== undefined && this.isBuffUntold(row.entry.rule)) this.showTip(row.frame, "TIP_RULE_BUFF_NO_CDM");
        });
        row.frame.SetScript("OnLeave", () => GameTooltip.Hide());
        row.isOn.SetScript("OnEnter", () => {
            if (row.entry?.ownIndex === undefined) this.showTip(row.isOn, "TIP_RULE_BUILT_IN");
        });
        row.isOn.SetScript("OnLeave", () => GameTooltip.Hide());
        row.remove.SetScript("OnClick", () => {
            const index = row.entry?.ownIndex;
            if (index !== undefined && this.settings.get("shouldUseProcRules")) this.edits.removeRule(index);
        });
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

    private createBox(frame: Frame, x: number, width: number, isNumeric: boolean): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(width, 20);
        box.SetPoint("LEFT", frame, "LEFT", x + 6, 0);
        box.SetAutoFocus(false);
        box.SetNumeric(isNumeric);
        box.SetScript("OnEscapePressed", () => box.ClearFocus());
        return box;
    }

    /** The switch and its words, the order of the rules, the columns' headers, and the frame of the rules under them. */
    private create(content: Frame): Frame {
        const holder = CreateFrame("Frame", undefined, content);
        this.holder = holder;
        const switchBox = CreateFrame("CheckButton", undefined, holder, "UICheckButtonTemplate");
        switchBox.SetSize(24, 24);
        switchBox.SetPoint("TOPLEFT", holder, "TOPLEFT", 0, 0);
        switchBox.SetScript("OnClick", () => this.settings.change("shouldUseProcRules", switchBox.GetChecked()));
        this.switchBox = switchBox;
        this.createText(holder, "GameFontNormal", this.locale.getText("OPT_USE_PROC_RULES"), 30, 4);
        const info = this.createText(holder, "GameFontHighlightSmall", this.locale.getText("INFO_USE_PROC_RULES"), 30, 24);
        info.SetWidth(AT.end + 10);
        this.createText(holder, "GameFontHighlightSmall", this.locale.getText("INFO_PROC_RULES_ORDER"), 0, SWITCH_HEIGHT);
        const unlearnedBox = CreateFrame("CheckButton", undefined, holder, "UICheckButtonTemplate");
        unlearnedBox.SetSize(22, 22);
        unlearnedBox.SetPoint("TOPLEFT", holder, "TOPLEFT", AT.on - 120, -SWITCH_HEIGHT - 18);
        unlearnedBox.SetScript("OnClick", () => this.windows.setUnlearnedShown("procRules", unlearnedBox.GetChecked()));
        this.unlearnedBox = unlearnedBox;
        this.createText(holder, "GameFontHighlightSmall", this.locale.getText("OPT_SHOW_UNLEARNED"), AT.on - 96, SWITCH_HEIGHT + 22);
        for (const [x, text] of HEADERS) this.createText(holder, "GameFontNormalSmall", this.locale.getText(text), x, RULES_TOP - 16);
        const rulesFrame = CreateFrame("Frame", undefined, holder);
        rulesFrame.SetPoint("TOPLEFT", holder, "TOPLEFT", 0, -RULES_TOP);
        this.rulesFrame = rulesFrame;
        return holder;
    }

    private createText(frame: Frame, font: string, words: string, x: number, top: number): FontString {
        const text = frame.CreateFontString(undefined, "OVERLAY", font);
        text.SetPoint("TOPLEFT", frame, "TOPLEFT", x, -top);
        text.SetJustifyH("LEFT");
        text.SetText(words);
        return text;
    }
}
