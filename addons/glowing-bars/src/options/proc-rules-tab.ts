// The Proc rules tab of the table of looks (beta): the switch of the new engine at the top, then the rules of each spell under
// its name, sorted by priority, and the row that adds one. The addon's own rules can only be switched off and on; the
// player's can be changed (priority, result, group) and taken out. While the switch is off, the rules are faded and do
// nothing. The glows' looks stay on the Procs tab, a row for each spell and each group.
import type { SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ProcRulesEditsService } from "../glows/proc-rules-edits.service";
import type { StyleWindowService } from "./style-window.service";
import type { ProcRulesAddRow } from "./proc-rules-add-row";
import { AT, RULE_HEIGHT, type ProcRuleRows, type RuleEntry } from "./proc-rule-rows";

/** The rules of one spell. */
interface SpellRules {
    spellId: number;
    label: string;
    entries: RuleEntry[];
}

const HEADING_HEIGHT = 26;
const FADED_ALPHA = 0.45; /** The height of the switch and its words. */
const SWITCH_HEIGHT = 56;
/** Where the rules start: under the switch, the order's line, the unlearned switch and the columns' headers. */
const RULES_TOP = SWITCH_HEIGHT + 64;

const HEADERS: [x: number, text: TextKey][] = [
    [AT.priority, "HDR_RULE_PRIORITY"],
    [AT.condition, "HDR_RULE_CONDITION"],
    [AT.id, "HDR_RULE_ID"],
    [AT.cdm, "HDR_RULE_CDM"],
    [AT.result, "HDR_RULE_RESULT"],
    [AT.group, "HDR_RULE_GROUP"],
    [AT.on, "HDR_RULE_ON"],
];

export class ProcRulesTab {
    private holder: Frame | undefined;
    private rulesFrame: Frame | undefined;
    private switchBox: CheckButton | undefined;
    private unlearnedBox: CheckButton | undefined;
    private readonly headings: { frame: Frame; icon: Texture; name: FontString; id: FontString }[] = [];

    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly edits: ProcRulesEditsService,
        private readonly windows: StyleWindowService,
        private readonly addRow: ProcRulesAddRow,
        private readonly rows: ProcRuleRows,
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
        this.rows.startDraw();
        for (const spell of this.listSpellRules()) {
            this.showHeading(usedHeadings++, spell, y);
            y += HEADING_HEIGHT;
            for (const entry of spell.entries) {
                this.rows.show(rulesFrame, entry, y, isOn);
                y += RULE_HEIGHT;
            }
        }
        for (let i = usedHeadings; i < this.headings.length; i++) this.headings[i]!.frame.Hide();
        this.rows.hideUnused();
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
            const id = frame.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
            id.SetPoint("LEFT", frame, "LEFT", AT.id, 0);
            heading = { frame, icon, name, id };
            this.headings.push(heading);
        }
        heading.frame.ClearAllPoints();
        heading.frame.SetPoint("TOPLEFT", this.rulesFrame!, "TOPLEFT", 0, -top);
        // The client takes an icon's file ID as well as a path; the typing knows only the path
        heading.icon.SetTexture(this.spells.getSpellInfo(spell.spellId)?.iconID as unknown as string);
        heading.name.SetText(spell.label);
        heading.id.SetText(string.format("%d", spell.spellId));
        heading.frame.SetAlpha(this.spells.isLearned(spell.spellId) ? 1 : 0.5);
        heading.frame.Show();
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
