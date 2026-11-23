// The Added spells tab of the Profiles window (issue #76): the spells added on any character of the account, and on which
// ones (on hover). Each character keeps its own list: Add puts a spell on this character too; Delete, asked first, takes it
// off every character. The rows are made as the list grows, and hidden while it is shorter.
import type { OptionsTab, OptionsWindow } from "@wowkit/ui";
import type { BagsService, SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { TYPE_ORDER } from "../settings/settings.constants";
import type { AddedSpell, AddonSettingsService } from "../settings/settings.interface";
import { TYPE_TEXTS } from "./style-rows.service";

const BUTTON_WIDTH = 80;
/** Where the buttons of a row start, as the other rows' controls do. */
const CONTROL_LEFT = 340;
const ICON_SIZE = 16;

/** One spell of the list, and where it is. */
interface CharacterSpell {
    spell: AddedSpell;
    name: string;
    /** "|T…|t Name (Type)": its row's label. */
    label: string;
    /** The characters it is on, by name. */
    characters: string[];
    /** Can it be added on this character: not there already (nor the same spell or item as another type)? */
    canAdd: boolean;
}

export class CharacterSpellsSection {
    private entries: CharacterSpell[] = [];
    private window: OptionsWindow | undefined;
    private tab: OptionsTab | undefined;
    private rowCount = 0;

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly bags: BagsService,
    ) {}

    /** The tab's title and words; the rows come with update. */
    build(window: OptionsWindow, tab: OptionsTab): void {
        this.window = window;
        this.tab = tab;
        tab.addHeader(this.readText("HDR_ADDED_SPELLS"));
        tab.addText(() => this.readText(this.entries.length > 0 ? "ADDED_SPELLS_INFO" : "ADDED_SPELLS_NONE"), "GameFontNormalSmall");
    }

    /** The list read again, with a row for each spell: before the window opens, and after a change. */
    update(): void {
        this.entries = this.listEntries();
        while (this.rowCount < this.entries.length) this.addRow(this.rowCount++);
    }

    private listEntries(): CharacterSpell[] {
        const thisKey = this.settings.getCharacterKey();
        const own = this.settings.getOfCharacter(thisKey, "addedSpells") ?? [];
        const byKey = new LuaMap<string, CharacterSpell>();
        const entries: CharacterSpell[] = [];
        for (const character of this.settings.listCharacters()) {
            for (const spell of this.settings.getOfCharacter(character.key, "addedSpells") ?? []) {
                const key = `${spell.reminderType}:${spell.id}`;
                let entry = byKey.get(key);
                if (entry === undefined) {
                    entry = this.describe(spell, !own.some((ownSpell) => isSameSpell(ownSpell, spell)));
                    byKey.set(key, entry);
                    entries.push(entry);
                }
                entry.characters.push(character.label);
            }
        }
        const findOrder = (entry: CharacterSpell) => TYPE_ORDER.indexOf(entry.spell.reminderType);
        table.sort(entries, (a, b) => (findOrder(a) !== findOrder(b) ? findOrder(a) < findOrder(b) : a.name < b.name));
        return entries;
    }

    private describe(spell: AddedSpell, canAdd: boolean): CharacterSpell {
        const isItem = spell.reminderType === "lowStock";
        const name = (isItem ? this.bags.getItemName(spell.id) : this.spells.getSpellLabel(spell.id)) ?? `#${spell.id}`;
        const icon = isItem ? findItemIcon(spell.id) : this.spells.getSpellInfo(spell.id)?.iconID;
        const picture = icon !== undefined ? `|T${icon}:${ICON_SIZE}|t ` : "";
        const label = `${picture}${name} (${this.readText(TYPE_TEXTS[spell.reminderType])})`;
        return { spell, name, label, characters: [], canAdd };
    }

    /** The row of the index-th spell of the list, whichever that is at the time. */
    private addRow(index: number): void {
        const tab = this.tab!;
        const row = tab.createRow("", undefined);
        const label = tab.findLabel(row);
        row.EnableMouse(true);
        row.SetScript("OnEnter", () => this.showCharacters(row, index));
        row.SetScript("OnLeave", () => GameTooltip.Hide());
        const add = this.createButton(row, CONTROL_LEFT, "BTN_ADD", () => this.addOnThisCharacter(index));
        const remove = this.createButton(row, CONTROL_LEFT + BUTTON_WIDTH + 6, "BTN_DELETE", () => this.confirmDelete(index));
        tab.addControl(row, {
            // A test's click: "delete", else Add
            apply: (value) => (value === "delete" ? this.confirmDelete(index) : this.addOnThisCharacter(index)),
            refresh: () => {
                const entry = this.entries[index];
                if (entry === undefined) return;
                label?.SetText(entry.label);
                if (!entry.canAdd) add.SetEnabled(false);
            },
            setEnabled: (isEnabled) => {
                add.SetEnabled(isEnabled);
                remove.SetEnabled(isEnabled);
            },
        }).showWhen(() => index < this.entries.length);
    }

    private showCharacters(row: Frame, index: number): void {
        const entry = this.entries[index];
        if (entry === undefined) return;
        GameTooltip.SetOwner(row, "ANCHOR_RIGHT");
        GameTooltip.SetText(this.readText("TIP_ADDED_ON"), 1, 1, 1, 1, true);
        for (const character of entry.characters) GameTooltip.AddLine(character);
        GameTooltip.Show();
    }

    private addOnThisCharacter(index: number): void {
        const entry = this.entries[index];
        if (entry === undefined || !entry.canAdd) return;
        const thisKey = this.settings.getCharacterKey();
        const own = this.settings.getOfCharacter(thisKey, "addedSpells") ?? [];
        this.settings.changeOfCharacter(thisKey, "addedSpells", [...own, { id: entry.spell.id, reminderType: entry.spell.reminderType }]);
        this.refresh();
    }

    private confirmDelete(index: number): void {
        const entry = this.entries[index];
        if (entry === undefined) return;
        const question = string.format(this.readText("Q_DELETE_ADDED"), entry.name);
        this.window?.confirm(question, this.readText("BTN_DELETE"), () => {
            for (const character of this.settings.listCharacters()) {
                const spells = this.settings.getOfCharacter(character.key, "addedSpells") ?? [];
                const kept = spells.filter((spell) => spell.id !== entry.spell.id || spell.reminderType !== entry.spell.reminderType);
                if (kept.length !== spells.length) this.settings.changeOfCharacter(character.key, "addedSpells", kept);
            }
            this.refresh();
        });
    }

    private refresh(): void {
        this.update();
        this.tab?.refresh();
    }

    private createButton(row: Frame, left: number, text: TextKey, onClick: () => void): Button {
        const button = CreateFrame("Button", undefined, row, "UIPanelButtonTemplate");
        button.SetSize(BUTTON_WIDTH, 22);
        button.SetPoint("LEFT", row, "LEFT", left, 0);
        button.SetText(this.readText(text));
        button.SetScript("OnClick", () => onClick());
        return button;
    }

    private readText(key: TextKey): string {
        return this.locale.getText(key);
    }
}

/** The same spell, or the same item: a character keeps an ID once, apart from an item (low stock) of the same number. */
function isSameSpell(a: AddedSpell, b: AddedSpell): boolean {
    return a.id === b.id && (a.reminderType === "lowStock") === (b.reminderType === "lowStock");
}

function findItemIcon(itemId: number): number | undefined {
    const [didSucceed, icon] = pcall(C_Item.GetItemIconByID, itemId);
    return didSucceed ? (icon as number | undefined) : undefined;
}
