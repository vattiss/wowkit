// The row at the end of the Proc rules tab that adds a rule of the player's: the spell, the condition (with the buff it asks
// for), the result, the priority and the group. A spell or buff the game does not know is refused, and the chat says why.
import { connectChoiceMenu, type MessagesService } from "@wowkit/ui";
import type { CooldownViewerService, SpellsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { CDM_TEXTS, findCdmStatus } from "./proc-rule-cdm";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { HEALTH_KINDS, HIDDEN_KINDS, type ProcRuleResult } from "../glows/proc-rules.interface";
import type { ProcRulesEditsService } from "../glows/proc-rules-edits.service";
import { CONDITION_CHOICES, describeChoice, type ConditionChoice } from "./proc-rule-words";

const LABEL_HEIGHT = 16;
const ROW_HEIGHT = 30;
/** Where each part of the row starts, from its left. */
const AT = { spell: 0, condition: 84, buff: 252, result: 334, priority: 438, group: 482, add: 598 };
const RESULT_TEXTS: { [result in ProcRuleResult]: TextKey } = { glow: "RULE_GLOW", noGlow: "RULE_NO_GLOW" };

export class ProcRulesAddRow {
    private frame: Frame | undefined;
    private choice: ConditionChoice = CONDITION_CHOICES[0]!;
    private result: ProcRuleResult = "glow";
    private parts: { spell: EditBox; buff: EditBox; stacks: EditBox; buffLabel: FontString; priority: EditBox; group: EditBox } | undefined;
    private controls: (Button | EditBox)[] = [];
    private showChoices: () => void = () => undefined;
    private isOn = false;

    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly edits: ProcRulesEditsService,
        private readonly messages: MessagesService,
        private readonly viewer: CooldownViewerService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** The row at `top` of `holder`; its controls work only while the rules are on. Returns where it ends. */
    draw(holder: Frame, top: number, isOn: boolean): number {
        const frame = this.frame ?? this.create(holder);
        frame.ClearAllPoints();
        frame.SetPoint("TOPLEFT", holder, "TOPLEFT", 0, -top);
        this.isOn = isOn;
        for (const control of this.controls) {
            if (isOn) control.Enable();
            else control.Disable();
        }
        this.showChoices();
        frame.Show();
        return top + LABEL_HEIGHT * 2 + ROW_HEIGHT;
    }

    hide(): void {
        this.frame?.Hide();
    }

    private create(holder: Frame): Frame {
        const frame = CreateFrame("Frame", undefined, holder);
        frame.SetSize(AT.add + 80, LABEL_HEIGHT * 2 + ROW_HEIGHT);
        this.frame = frame;
        const buffLabel = this.createLabels(frame);
        const rowTop = LABEL_HEIGHT * 2;
        const spell = this.createBox(frame, AT.spell + 6, rowTop, 70, true);
        const buff = this.createBox(frame, AT.buff + 6, rowTop, 70, true);
        const priority = this.createBox(frame, AT.priority + 6, rowTop, 30, true);
        priority.SetMaxLetters(1);
        priority.SetText("1");
        const group = this.createBox(frame, AT.group + 6, rowTop, 100, false);
        // Beside the buff's box, made last: the boxes before it keep their order
        const stacks = this.createBox(frame, AT.buff + 54, rowTop, 22, true);
        stacks.SetMaxLetters(2);
        this.parts = { spell, buff, stacks, buffLabel, priority, group };
        const conditionButton = this.createButton(frame, AT.condition, rowTop, 160);
        const resultButton = this.createButton(frame, AT.result, rowTop, 96);
        const addButton = this.createButton(frame, AT.add, rowTop, 70);
        addButton.SetText(this.locale.getText("BTN_ADD"));
        addButton.SetScript("OnClick", () => this.addRule());
        this.controls = [spell, buff, stacks, priority, group, conditionButton, resultButton, addButton];
        this.showChoices = () => this.applyChoice(conditionButton, resultButton);
        resultButton.SetScript("OnEnter", () => {
            if (!HIDDEN_KINDS.includes(this.choice.kind)) return;
            GameTooltip.SetOwner(resultButton, "ANCHOR_RIGHT");
            GameTooltip.SetText(this.locale.getText("TIP_RULE_HEALTH_RESULT"), 1, 1, 1, 1, true);
            GameTooltip.Show();
        });
        resultButton.SetScript("OnLeave", () => GameTooltip.Hide());
        this.connectMenus(conditionButton, resultButton);
        this.showChoices();
        return frame;
    }

    /** The row as the condition chosen has it: the boxes it takes, and the result (a hidden kind's glow can only light). */
    private applyChoice(conditionButton: Button, resultButton: Button): void {
        const { buff, stacks, buffLabel } = this.parts!;
        const kind = this.choice.kind;
        // The game hides what such a rule asks: nothing can keep its spell dark
        const isHidden = HIDDEN_KINDS.includes(kind);
        if (isHidden) this.result = "glow";
        conditionButton.SetText(describeChoice(this.choice, this.locale));
        resultButton.SetText(this.locale.getText(RESULT_TEXTS[this.result]));
        const isHealth = HEALTH_KINDS.includes(kind);
        const isStacks = kind === "buffStacks";
        const hasValue = kind === "buff" || isHealth || isStacks;
        buff.SetShown(hasValue);
        buff.SetWidth(isStacks ? 44 : 70);
        stacks.SetShown(isStacks);
        buffLabel.SetShown(hasValue);
        buffLabel.SetText(this.locale.getText(isHealth ? "LABEL_RULE_PERCENT" : isStacks ? "LABEL_RULE_STACKS" : "LABEL_RULE_BUFF"));
        if (isHidden) resultButton.Disable();
        else if (this.isOn) resultButton.Enable();
    }

    /** The words over the row: its header, and the name of each part; returns the one over the buff, which changes. */
    private createLabels(frame: Frame): FontString {
        this.createText(frame, "GameFontNormal", this.locale.getText("HDR_RULE_ADD"), 0, 0);
        const labelTop = LABEL_HEIGHT;
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("LABEL_RULE_SPELL"), AT.spell, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_CONDITION"), AT.condition, labelTop);
        const buffLabel = this.createText(frame, "GameFontNormalSmall", this.locale.getText("LABEL_RULE_BUFF"), AT.buff, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_RESULT"), AT.result, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_PRIORITY"), AT.priority, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_GROUP"), AT.group, labelTop);
        return buffLabel;
    }

    /** The lists of the condition and of the result. */
    private connectMenus(conditionButton: Button, resultButton: Button): void {
        connectChoiceMenu(conditionButton, () =>
            CONDITION_CHOICES.map((choice) => ({
                label: describeChoice(choice, this.locale),
                isChosen: () => choice === this.choice,
                choose: () => {
                    this.choice = choice;
                    this.showChoices();
                },
            })),
        );
        connectChoiceMenu(resultButton, () =>
            (["glow", "noGlow"] as const).map((result) => ({
                label: this.locale.getText(RESULT_TEXTS[result]),
                isChosen: () => result === this.result,
                choose: () => {
                    this.result = result;
                    this.showChoices();
                },
            })),
        );
    }

    /** Adds the rule the row says, or says what is wrong with it. */
    private addRule(): void {
        const parts = this.parts!;
        const spellId = tonumber(parts.spell.GetText());
        if (spellId === undefined || this.spells.getSpellInfo(spellId) === undefined) {
            return this.messages.say(string.format(this.locale.getText("MSG_UNKNOWN_SPELL"), spellId ?? 0));
        }
        const value = this.readValue(parts.buff.GetText());
        if (value === false) return;
        const stacks = this.readStacks(parts.stacks.GetText());
        if (stacks === false) return;
        // A rule on the health with no group still has a row of its own, named by its condition: no name is saved for it
        const group = strtrim(parts.group.GetText() ?? "");
        const priority = math.max(1, math.min(9, tonumber(parts.priority.GetText()) ?? 1));
        this.edits.addRule({
            spellId,
            kind: this.choice.kind,
            value,
            stacks,
            result: this.result,
            priority,
            group: group !== "" ? group : undefined,
        });
        if (value !== undefined) this.sayCdmStatus(value);
        for (const box of [parts.spell, parts.buff, parts.stacks, parts.group]) box.SetText("");
        for (const box of [parts.spell, parts.buff, parts.stacks, parts.group, parts.priority]) box.ClearFocus();
    }

    /**
     * Where a new rule's buff (up, or at stacks) stands with the Cooldown Manager, which alone tells it in a fight: what to do,
     * if anything. Nothing for a rule of another kind.
     */
    private sayCdmStatus(buffId: number): void {
        if (this.choice.kind !== "buff" && this.choice.kind !== "buffStacks") return;
        const status = findCdmStatus(buffId, this.spells, this.viewer, this.settings);
        const name = this.spells.getSpellLabel(buffId) ?? string.format("%d", buffId);
        this.messages.say(`${name}: ${this.locale.getText(CDM_TEXTS[status].tip)}`);
    }

    /** The value the condition takes: the creature type picked, the buff, or the percent typed; false when it is wrong (the chat says why). */
    private readValue(typed: string): number | undefined | false {
        const kind = this.choice.kind;
        const number = tonumber(typed);
        if (HEALTH_KINDS.includes(kind)) {
            if (number !== undefined && number >= 1 && number <= 99) return math.floor(number);
            this.messages.say(this.locale.getText("MSG_RULE_NO_PERCENT"));
            return false;
        }
        if (kind !== "buff" && kind !== "buffStacks") return this.choice.creatureType;
        if (number === undefined) this.messages.say(this.locale.getText("MSG_RULE_NO_BUFF"));
        else if (this.spells.getSpellInfo(number) === undefined)
            this.messages.say(string.format(this.locale.getText("MSG_UNKNOWN_SPELL"), number));
        else return number;
        return false;
    }

    /** The stacks typed, 1 to 99, for a rule on a buff's stacks (none for another); false when wrong (the chat says why). */
    private readStacks(typed: string): number | undefined | false {
        if (this.choice.kind !== "buffStacks") return undefined;
        const number = tonumber(typed);
        if (number !== undefined && number >= 1 && number <= 99) return math.floor(number);
        this.messages.say(this.locale.getText("MSG_RULE_NO_STACKS"));
        return false;
    }

    private createText(frame: Frame, font: string, words: string, x: number, top: number): FontString {
        const text = frame.CreateFontString(undefined, "OVERLAY", font);
        text.SetPoint("TOPLEFT", frame, "TOPLEFT", x, -top);
        text.SetJustifyH("LEFT");
        text.SetText(words);
        return text;
    }

    private createBox(frame: Frame, x: number, top: number, width: number, isNumeric: boolean): EditBox {
        const box = CreateFrame("EditBox", undefined, frame, "InputBoxTemplate");
        box.SetSize(width, 20);
        box.SetPoint("TOPLEFT", frame, "TOPLEFT", x, -top - 4);
        box.SetAutoFocus(false);
        box.SetNumeric(isNumeric);
        box.SetScript("OnEnterPressed", () => box.ClearFocus());
        box.SetScript("OnEscapePressed", () => box.ClearFocus());
        return box;
    }

    private createButton(frame: Frame, x: number, top: number, width: number): Button {
        const button = CreateFrame("Button", undefined, frame, "UIPanelButtonTemplate");
        button.SetSize(width, 24);
        button.SetPoint("TOPLEFT", frame, "TOPLEFT", x, -top - 2);
        return button;
    }
}
