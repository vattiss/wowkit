// The row at the end of the Proc rules tab that adds a rule of the player's: the spell, the condition (with the buff it asks
// for), the result, the priority and the group. A spell or buff the game does not know is refused, and the chat says why.
import { connectChoiceMenu, type MessagesService } from "@wowkit/ui";
import type { SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { ProcRuleResult } from "../glows/proc-rules.interface";
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
    private parts: { spell: EditBox; buff: EditBox; buffLabel: FontString; priority: EditBox; group: EditBox } | undefined;
    private controls: (Button | EditBox)[] = [];
    private showChoices: () => void = () => undefined;

    constructor(
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly edits: ProcRulesEditsService,
        private readonly messages: MessagesService,
    ) {}

    /** The row at `top` of `holder`; its controls work only while the rules are on. Returns where it ends. */
    draw(holder: Frame, top: number, isOn: boolean): number {
        const frame = this.frame ?? this.create(holder);
        frame.ClearAllPoints();
        frame.SetPoint("TOPLEFT", holder, "TOPLEFT", 0, -top);
        for (const control of this.controls) {
            if (isOn) control.Enable();
            else control.Disable();
        }
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
        this.createText(frame, "GameFontNormal", this.locale.getText("HDR_RULE_ADD"), 0, 0);
        const labelTop = LABEL_HEIGHT;
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("LABEL_RULE_SPELL"), AT.spell, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_CONDITION"), AT.condition, labelTop);
        const buffLabel = this.createText(frame, "GameFontNormalSmall", this.locale.getText("LABEL_RULE_BUFF"), AT.buff, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_RESULT"), AT.result, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_PRIORITY"), AT.priority, labelTop);
        this.createText(frame, "GameFontNormalSmall", this.locale.getText("HDR_RULE_GROUP"), AT.group, labelTop);
        const rowTop = LABEL_HEIGHT * 2;
        const spell = this.createBox(frame, AT.spell + 6, rowTop, 70, true);
        const buff = this.createBox(frame, AT.buff + 6, rowTop, 70, true);
        const priority = this.createBox(frame, AT.priority + 6, rowTop, 30, true);
        priority.SetMaxLetters(1);
        priority.SetText("1");
        const group = this.createBox(frame, AT.group + 6, rowTop, 100, false);
        this.parts = { spell, buff, buffLabel, priority, group };
        const conditionButton = this.createButton(frame, AT.condition, rowTop, 160);
        const resultButton = this.createButton(frame, AT.result, rowTop, 96);
        const addButton = this.createButton(frame, AT.add, rowTop, 70);
        addButton.SetText(this.locale.getText("BTN_ADD"));
        addButton.SetScript("OnClick", () => this.addRule());
        this.controls = [spell, buff, priority, group, conditionButton, resultButton, addButton];
        this.showChoices = () => {
            conditionButton.SetText(describeChoice(this.choice, this.locale));
            resultButton.SetText(this.locale.getText(RESULT_TEXTS[this.result]));
            const isBuff = this.choice.kind === "buff" || this.choice.kind === "buffGone";
            buff.SetShown(isBuff);
            buffLabel.SetShown(isBuff);
        };
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
        this.showChoices();
        return frame;
    }

    /** Adds the rule the row says, or says what is wrong with it. */
    private addRule(): void {
        const parts = this.parts!;
        const spellId = tonumber(parts.spell.GetText());
        if (spellId === undefined || this.spells.getSpellInfo(spellId) === undefined) {
            return this.messages.say(string.format(this.locale.getText("MSG_UNKNOWN_SPELL"), spellId ?? 0));
        }
        let value = this.choice.creatureType;
        if (this.choice.kind === "buff" || this.choice.kind === "buffGone") {
            value = tonumber(parts.buff.GetText());
            if (value === undefined) return this.messages.say(this.locale.getText("MSG_RULE_NO_BUFF"));
            if (this.spells.getSpellInfo(value) === undefined) {
                return this.messages.say(string.format(this.locale.getText("MSG_UNKNOWN_SPELL"), value));
            }
        }
        const group = strtrim(parts.group.GetText());
        const priority = math.max(1, math.min(9, tonumber(parts.priority.GetText()) ?? 1));
        this.edits.addRule({
            spellId,
            kind: this.choice.kind,
            value,
            result: this.result,
            priority,
            group: group !== "" ? group : undefined,
        });
        parts.spell.SetText("");
        parts.buff.SetText("");
        parts.group.SetText("");
        for (const box of [parts.spell, parts.buff, parts.group, parts.priority]) box.ClearFocus();
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
