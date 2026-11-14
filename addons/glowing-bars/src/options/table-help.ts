// The Help tab of the table of looks: each column of the view, under the words of its header, what it does and what it can
// be set to. The choices are read from the lists the columns offer, under the names they show there.
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { When } from "../settings/settings.interface";
import { ANIMATION_CHOICES, GLOW_TIME_CHOICES, REPEAT_CHOICES } from "../settings/settings.constants";
import { ANIMATION_TEXTS } from "./animation.section";
import { WHEN_TEXTS, type StyleChoicesService } from "./style-choices.service";
import { findColumns } from "./style-table.constants";

/** The columns explained, in the order of the table: their header's words and the help on them. */
const HELP_COLUMNS: [column: keyof ReturnType<typeof findColumns>, title: TextKey, help: TextKey][] = [
    ["name", "COL_SPELL_ITEM", "HELP_SPELL_ITEM"],
    ["type", "COL_TYPE", "HELP_TYPE"],
    ["id", "COL_SPELL_ITEM_ID", "HELP_ID"],
    ["color", "COL_COLOR", "HELP_COLOR"],
    ["glowPercent", "COL_GLOW_PERCENT", "HELP_GLOW_PERCENT"],
    ["message", "COL_MESSAGE", "HELP_MESSAGE"],
    ["messageLook", "COL_MESSAGE_LOOK", "HELP_MESSAGE_LOOK"],
    ["sound", "COL_SOUND", "HELP_SOUND"],
    ["repeat", "COL_REPEAT", "HELP_REPEAT"],
    ["when", "COL_WHEN", "HELP_WHEN"],
    ["glowTime", "COL_GLOW_TIME", "HELP_GLOW_TIME"],
    ["animation", "COL_ANIMATION", "HELP_ANIMATION"],
    ["belowLimits", "COL_BELOW", "HELP_BELOW"],
    ["enabled", "COL_ENABLED", "HELP_ENABLED"],
    ["actions", "COL_ACTIONS", "HELP_ACTIONS"],
];

/** Every When a row can have, in the order of the lists. */
const ALL_WHENS: When[] = [
    "always",
    "alwaysStart",
    "inCombat",
    "inCombatStart",
    "outOfCombat",
    "outOfCombatStart",
    "enemyTargeted",
    "allyTargeted",
    "anyTargeted",
    "townAlert",
];

const MESSAGE_CHOICES: TextKey[] = ["TEXT_CHOICE_TYPE_ONLY", "TEXT_CHOICE_TYPE_AND_NAME", "TEXT_CHOICE_NAME", "TEXT_CHOICE_CUSTOM"];
const TITLE_HEIGHT = 18;
const BODY_INDENT = 12;
const GAP = 10;

export class TableHelp {
    private readonly texts: FontString[] = [];
    private usedTexts = 0;

    constructor(
        private readonly locale: AddonLocale,
        private readonly choices: StyleChoicesService,
    ) {}

    /** The help on the columns of the view, from `top`, this wide; returns where it ends. */
    draw(content: Frame, top: number, width: number, isAdvanced: boolean): number {
        this.usedTexts = 0;
        let y = this.showText(content, "GameFontHighlight", this.locale.getText("HELP_INTRO"), 0, top, width) + GAP;
        const columns = findColumns(isAdvanced);
        for (const [column, title, help] of HELP_COLUMNS) {
            if (columns[column] === undefined) continue;
            this.showText(content, "GameFontNormal", this.locale.getText(title), 0, y, width);
            y =
                this.showText(content, "GameFontHighlightSmall", this.describe(help), BODY_INDENT, y + TITLE_HEIGHT, width - BODY_INDENT) +
                GAP;
        }
        for (let i = this.usedTexts; i < this.texts.length; i++) this.texts[i]!.Hide();
        return y;
    }

    hide(): void {
        for (const text of this.texts) text.Hide();
    }

    /** The help on a column, with its choices where it has a list of them. */
    private describe(help: TextKey): string {
        const words = this.locale.getText(help);
        const list = this.listChoices(help);
        return list !== undefined ? string.format(words, list) : words;
    }

    private listChoices(help: TextKey): string | undefined {
        if (help === "HELP_WHEN") return ALL_WHENS.map((when) => this.locale.getText(WHEN_TEXTS[when])).join(", ");
        if (help === "HELP_GLOW_TIME") return GLOW_TIME_CHOICES.map((seconds) => this.choices.findGlowTimeText(seconds)).join(", ");
        if (help === "HELP_REPEAT") return REPEAT_CHOICES.map((seconds) => this.choices.findRepeatText(seconds)).join(", ");
        if (help === "HELP_ANIMATION")
            return ANIMATION_CHOICES.map((animation) => this.locale.getText(ANIMATION_TEXTS[animation])).join(", ");
        if (help === "HELP_MESSAGE_LOOK") return MESSAGE_CHOICES.map((choice) => this.locale.getText(choice)).join(", ");
        return undefined;
    }

    /** A text at (`x`, `top`), wrapped to `width`; returns where the next one goes. */
    private showText(content: Frame, font: string, words: string, x: number, top: number, width: number): number {
        let text = this.texts[this.usedTexts];
        if (text === undefined) {
            text = content.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
            text.SetJustifyH("LEFT");
            this.texts.push(text);
        }
        this.usedTexts += 1;
        text.SetFontObject(font);
        text.ClearAllPoints();
        text.SetPoint("TOPLEFT", content, "TOPLEFT", x, -top);
        text.SetWidth(width);
        text.SetText(words);
        text.Show();
        return top + ((text.GetStringHeight() as number | undefined) ?? TITLE_HEIGHT);
    }
}
