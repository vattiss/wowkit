// The Added spells tab of the Profiles window (issue #76): the spells added on any character of the account, and on which
// ones (on hover). Each character keeps its own list: Add puts a spell on this character too; Delete, asked first, takes it
// off every character. The rows are made as the list grows, and hidden while it is shorter.
import type { OptionsTab, OptionsWindow } from "@wowkit/ui";
import type { BagsService, SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { FedBuffsService } from "../reminders/fed-buffs.service";
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
    /** The items asked of the client, once each: every answer (GET_ITEM_INFO_RECEIVED) refreshes the list, which must not ask again. */
    private readonly requestedItems = new LuaSet<number>();

    constructor(
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly spells: SpellsService,
        private readonly bags: BagsService,
        private readonly fedBuffs: FedBuffsService,
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
        const look = this.findLook(spell);
        const name = look.name ?? `#${spell.id}`;
        const icon = look.iconId;
        const picture = icon !== undefined ? `|T${icon}:${ICON_SIZE}|t ` : "";
        const label = `${picture}${name} (${this.readText(TYPE_TEXTS[spell.reminderType])})`;
        return { spell, name, label, characters: [], canAdd };
    }

    /**
     * Its name and icon, as the table shows them: an item by its own, and a food or drink, or a weapon buff put on with an
     * item, by that item (many foods share one spell name): this character's, else another's. Any other spell by its own.
     */
    private findLook(spell: AddedSpell): { name: string | undefined; iconId: number | undefined } {
        if (spell.reminderType === "lowStock") return this.readItemLook(spell.id);
        // This character's item is learned from its bars as the table learns it, then read with the others' as the fallback
        if (spell.reminderType === "weaponBuff" || this.fedBuffs.isFedSpell(spell.id)) this.fedBuffs.findItemLook(spell.id);
        const itemId = this.findFedItem(spell.id);
        const item = itemId !== undefined ? this.readItemLook(itemId) : undefined;
        return {
            name: item?.name ?? this.spells.getSpellLabel(spell.id),
            iconId: item?.iconId ?? this.spells.getSpellInfo(spell.id)?.iconID,
        };
    }

    /** The item a character ate (or put on) for this spell: this one's, else the first other character's that knows one. */
    private findFedItem(spellId: number): number | undefined {
        const key = string.format("%d", spellId);
        const own = this.settings.get("fedItems")[key];
        if (own !== undefined) return own;
        for (const character of this.settings.listCharacters()) {
            const itemId = this.settings.getOfCharacter(character.key, "fedItems")?.[key];
            if (itemId !== undefined) return itemId;
        }
        return undefined;
    }

    /** An item's name and icon; a name the client has not loaded yet is asked for, and comes with GET_ITEM_INFO_RECEIVED. */
    private readItemLook(itemId: number): { name: string | undefined; iconId: number | undefined } {
        const name = this.bags.getItemName(itemId);
        if (name === undefined && !this.requestedItems.has(itemId)) {
            this.requestedItems.add(itemId);
            pcall(C_Item.RequestLoadItemDataByID, itemId);
        }
        return { name, iconId: findItemIcon(itemId) };
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
        // Its item comes along, so this character's table names it so too until its own bars show another
        const key = string.format("%d", entry.spell.id);
        const itemId = entry.spell.reminderType !== "lowStock" ? this.findFedItem(entry.spell.id) : undefined;
        const fedItems = this.settings.get("fedItems");
        if (itemId !== undefined && fedItems[key] === undefined) this.settings.change("fedItems", { ...fedItems, [key]: itemId });
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

    /** An item's data came in: the list is named again where it was one this asked for. */
    refreshNames(itemId: number): void {
        if (this.requestedItems.has(itemId)) this.refresh();
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
