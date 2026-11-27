// The Help tab of the table of looks: each column of the view, under the words of its header, what it does, and each of
// its choices on a line of its own, under the name the column's list shows.
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { ReminderType, When } from "../settings/settings.interface";
import { GLOW_TIME_CHOICES, REPEAT_CHOICES } from "../settings/settings.constants";
import { WHEN_TEXTS, type StyleChoicesService } from "./style-choices.service";
import { findColumns } from "./style-table.constants";
import { TYPE_TEXTS } from "./style-rows.service";

/** A choice of a column: its name in the list, and what it does. */
interface HelpChoice {
    label: string;
    help: TextKey;
}

/** What goes where, in the order of the tabs: a kind of thing, and the tab, the type and the ID it is added by. */
const WHERE_HELP: [label: TextKey, help: TextKey][] = [
    ["HELP_WHERE_BUFFS", "HELP_WHERE_BUFFS_HOW"],
    ["HELP_WHERE_WEAPON", "HELP_WHERE_WEAPON_HOW"],
    ["HELP_WHERE_SEAL", "HELP_WHERE_SEAL_HOW"],
    ["HELP_WHERE_TRACKING", "HELP_WHERE_TRACKING_HOW"],
    ["HELP_WHERE_TRINKETS", "HELP_WHERE_TRINKETS_HOW"],
    ["HELP_WHERE_TRAVEL", "HELP_WHERE_TRAVEL_HOW"],
    ["HELP_WHERE_PROC", "HELP_WHERE_PROC_HOW"],
    ["HELP_WHERE_PROC_RULE", "HELP_WHERE_PROC_RULE_HOW"],
    ["HELP_WHERE_REAGENT", "HELP_WHERE_REAGENT_HOW"],
    ["HELP_WHERE_STOCK", "HELP_WHERE_STOCK_HOW"],
];

/** The proc rules (beta): what each part of a rule does, and what the engine can and cannot tell. */
const RULES_HELP: [label: TextKey, help: TextKey][] = [
    ["HELP_RULES_PRIORITY", "HELP_RULES_PRIORITY_HOW"],
    ["HELP_RULES_RESULT", "HELP_RULES_RESULT_HOW"],
    ["HELP_RULES_GROUP", "HELP_RULES_GROUP_HOW"],
    ["HELP_RULES_BUILT_IN", "HELP_RULES_BUILT_IN_HOW"],
    ["HELP_RULES_CDM", "HELP_RULES_CDM_HOW"],
    ["HELP_RULES_FIGHT", "HELP_RULES_FIGHT_HOW"],
    ["HELP_RULES_RANGE", "HELP_RULES_RANGE_HOW"],
    ["HELP_RULES_HEALTH", "HELP_RULES_HEALTH_HOW"],
];

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

/** Every type of reminder, in the order of the tabs, and what makes it glow. */
const TYPE_HELP: [reminderType: ReminderType, help: TextKey][] = [
    ["missingBuff", "HELP_TYPE_MISSING_BUFF"],
    ["weaponBuff", "HELP_TYPE_WEAPON_BUFF"],
    ["missingSeal", "HELP_TYPE_MISSING_SEAL"],
    ["missingTracking", "HELP_TYPE_MISSING_TRACKING"],
    ["totemGone", "HELP_TYPE_TOTEM_GONE"],
    ["readyCooldown", "HELP_TYPE_READY_COOLDOWN"],
    ["utilityCooldown", "HELP_TYPE_UTILITY_COOLDOWN"],
    ["proc", "HELP_TYPE_PROC"],
    ["lowReagent", "HELP_TYPE_LOW_REAGENT"],
    ["lowStock", "HELP_TYPE_LOW_STOCK"],
    ["oldRank", "HELP_TYPE_OLD_RANK"],
];

/** Every When a row can have, in the order of the lists, and what each does. */
const WHEN_HELP: [when: When, help: TextKey][] = [
    ["always", "HELP_WHEN_ALWAYS"],
    ["alwaysStart", "HELP_WHEN_ALWAYS_START"],
    ["inCombat", "HELP_WHEN_IN_COMBAT"],
    ["inCombatStart", "HELP_WHEN_IN_COMBAT_START"],
    ["outOfCombat", "HELP_WHEN_OUT_OF_COMBAT"],
    ["outOfCombatStart", "HELP_WHEN_OUT_OF_COMBAT_START"],
    ["enemyTargeted", "HELP_WHEN_ENEMY_TARGETED"],
    ["allyTargeted", "HELP_WHEN_ALLY_TARGETED"],
    ["anyTargeted", "HELP_WHEN_ANY_TARGETED"],
    ["townAlert", "HELP_WHEN_TOWN_ALERT"],
];

/** The words of the message: the choice and what it says. */
const TEXT_HELP: [choice: TextKey, help: TextKey][] = [
    ["TEXT_CHOICE_TYPE_ONLY", "HELP_TEXT_TYPE_ONLY"],
    ["TEXT_CHOICE_TYPE_AND_NAME", "HELP_TEXT_TYPE_AND_NAME"],
    ["TEXT_CHOICE_NAME", "HELP_TEXT_NAME"],
    ["TEXT_CHOICE_CUSTOM", "HELP_TEXT_CUSTOM"],
];

/** An animation is a movement and a look: each of them, with what it is. */
const ANIMATION_HELP: [label: TextKey, help: TextKey][] = [
    ["HELP_LABEL_CIRCLING", "HELP_ANIMATION_CIRCLING"],
    ["HELP_LABEL_BREATHING", "HELP_ANIMATION_BREATHING"],
    ["HELP_LABEL_NONE", "HELP_ANIMATION_NONE"],
    ["HELP_LABEL_ANTS", "HELP_ANIMATION_ANTS"],
    ["HELP_LABEL_CLEAN", "HELP_ANIMATION_CLEAN"],
    ["HELP_LABEL_CLASSIC", "HELP_ANIMATION_CLASSIC"],
    ["HELP_LABEL_ORIGINAL", "HELP_ANIMATION_ORIGINAL"],
];

const TITLE_HEIGHT = 22;
/** The fonts of the help, a size larger than the table's: the intro, a column's name, and what it does. */
const INTRO_FONT = "GameFontHighlightMedium";
const TITLE_FONT = "GameFontNormalLarge";
const BODY_FONT = "GameFontHighlight";
const BODY_INDENT = 12;
const BULLET_INDENT = 24;
const GAP = 10;
/** The gold of the game's headers: the name of a choice. */
const CHOICE_COLOR = "|cffffd100";

export class TableHelp {
    private readonly texts: FontString[] = [];
    private usedTexts = 0;
    /** How far from the content's left edge the help starts: in the middle of a window wider than it. */
    private left = 0;

    constructor(
        private readonly locale: AddonLocale,
        private readonly choices: StyleChoicesService,
    ) {}

    /** The help on the columns of the view, from `top`, this wide, `left` in; returns where it ends. */
    draw(content: Frame, top: number, width: number, isAdvanced: boolean, left = 0): number {
        this.usedTexts = 0;
        this.left = left;
        let y = this.showWhereToAdd(content, top, width) + GAP * 2;
        y = this.showList(content, "HELP_RULES_TITLE", "HELP_RULES_INTRO", RULES_HELP, y, width) + GAP * 2;
        y = this.showText(content, INTRO_FONT, this.locale.getText("HELP_INTRO"), 0, y, width) + GAP;
        const columns = findColumns(isAdvanced);
        for (const [column, title, help] of HELP_COLUMNS) {
            if (columns[column] === undefined) continue;
            this.showText(content, TITLE_FONT, this.locale.getText(title), 0, y, width);
            y = this.showText(content, BODY_FONT, this.locale.getText(help), BODY_INDENT, y + TITLE_HEIGHT, width - BODY_INDENT);
            for (const choice of this.listChoices(help)) {
                const words = `•  ${CHOICE_COLOR}${choice.label}|r: ${this.locale.getText(choice.help)}`;
                y = this.showText(content, BODY_FONT, words, BULLET_INDENT, y + 2, width - BULLET_INDENT);
            }
            y += GAP;
        }
        for (let i = this.usedTexts; i < this.texts.length; i++) this.texts[i]!.Hide();
        return y;
    }

    /** First: what to add under which type, so nothing goes under one that cannot work for it; returns where it ends. */
    private showWhereToAdd(content: Frame, top: number, width: number): number {
        this.showText(content, TITLE_FONT, this.locale.getText("HELP_WHERE_TITLE"), 0, top, width);
        let y = this.showText(
            content,
            BODY_FONT,
            this.locale.getText("HELP_WHERE_INTRO"),
            BODY_INDENT,
            top + TITLE_HEIGHT,
            width - BODY_INDENT,
        );
        for (const [label, help] of WHERE_HELP) {
            const words = `•  ${CHOICE_COLOR}${this.locale.getText(label)}|r: ${this.locale.getText(help)}`;
            y = this.showText(content, BODY_FONT, words, BULLET_INDENT, y + 2, width - BULLET_INDENT);
        }
        return this.showText(content, BODY_FONT, this.locale.getText("HELP_WHERE_IDS"), BODY_INDENT, y + 4, width - BODY_INDENT);
    }

    /** A title, its words, and a line for each of its parts: the name in gold, then what it does; returns where it ends. */
    private showList(content: Frame, title: TextKey, intro: TextKey, lines: [TextKey, TextKey][], top: number, width: number): number {
        this.showText(content, TITLE_FONT, this.locale.getText(title), 0, top, width);
        let y = this.showText(content, BODY_FONT, this.locale.getText(intro), BODY_INDENT, top + TITLE_HEIGHT, width - BODY_INDENT);
        for (const [label, help] of lines) {
            const words = `•  ${CHOICE_COLOR}${this.locale.getText(label)}|r: ${this.locale.getText(help)}`;
            y = this.showText(content, BODY_FONT, words, BULLET_INDENT, y + 2, width - BULLET_INDENT);
        }
        return y;
    }

    hide(): void {
        for (const text of this.texts) text.Hide();
    }

    /** The choices of a column, each with what it does; none for a column without a list. */
    private listChoices(help: TextKey): HelpChoice[] {
        const getText = (key: TextKey) => this.locale.getText(key);
        if (help === "HELP_TYPE")
            return TYPE_HELP.map(([reminderType, typeHelp]) => ({ label: getText(TYPE_TEXTS[reminderType]), help: typeHelp }));
        if (help === "HELP_WHEN") return WHEN_HELP.map(([when, whenHelp]) => ({ label: getText(WHEN_TEXTS[when]), help: whenHelp }));
        if (help === "HELP_MESSAGE_LOOK") return TEXT_HELP.map(([choice, choiceHelp]) => ({ label: getText(choice), help: choiceHelp }));
        if (help === "HELP_ANIMATION") return ANIMATION_HELP.map(([label, labelHelp]) => ({ label: getText(label), help: labelHelp }));
        if (help === "HELP_GLOW_TIME")
            return this.listTimes(GLOW_TIME_CHOICES, (seconds) => this.choices.findGlowTimeText(seconds), "HELP_GLOW");
        if (help === "HELP_REPEAT") return this.listTimes(REPEAT_CHOICES, (seconds) => this.choices.findRepeatText(seconds), "HELP_REPEAT");
        if (help === "HELP_ACTIONS") {
            return [
                { label: getText("BTN_RESET"), help: "HELP_ACTION_RESET" },
                { label: getText("HELP_LABEL_REMOVE"), help: "HELP_ACTION_REMOVE" },
            ];
        }
        return [];
    }

    /** A list of times: its 0 (Until done, Off) on a line, and the seconds together on another. */
    private listTimes(
        choices: number[],
        findText: (this: void, seconds: number) => string,
        prefix: "HELP_GLOW" | "HELP_REPEAT",
    ): HelpChoice[] {
        const seconds = choices.filter((choice) => choice > 0).map((choice) => findText(choice));
        return [
            { label: findText(0), help: prefix === "HELP_GLOW" ? "HELP_GLOW_UNTIL_DONE" : "HELP_REPEAT_OFF" },
            { label: seconds.join(", "), help: prefix === "HELP_GLOW" ? "HELP_GLOW_SECONDS" : "HELP_REPEAT_SECONDS" },
        ];
    }

    /** A text at (`x`, `top`), wrapped to `width`; returns where the next one goes. */
    private showText(content: Frame, font: string, words: string, x: number, top: number, width: number): number {
        let text = this.texts[this.usedTexts];
        if (text === undefined) {
            text = content.CreateFontString(undefined, "OVERLAY", BODY_FONT);
            text.SetJustifyH("LEFT");
            this.texts.push(text);
        }
        this.usedTexts += 1;
        text.SetFontObject(font);
        text.ClearAllPoints();
        text.SetPoint("TOPLEFT", content, "TOPLEFT", this.left + x, -top);
        text.SetWidth(width);
        text.SetText(words);
        text.Show();
        return top + ((text.GetStringHeight() as number | undefined) ?? TITLE_HEIGHT);
    }
}
