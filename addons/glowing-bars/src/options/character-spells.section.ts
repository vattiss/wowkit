// The Added spells window's list (issue #76): the spells added on any character of the account. Each character
// keeps its own list: Add and Remove change this character's; a spell no character has any more leaves the tab. Characters
// shows which ones have it, and deletes it from all of them. The rows are made as the list grows, and hidden while shorter.
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
/** The most characters the Characters box names; the rest are counted, so the box fits on the screen. */
const MOST_LISTED = 15;

/** One spell of the list, and where it is. */
interface CharacterSpell {
    spell: AddedSpell;
    name: string;
    /** "|T…|t Name (Type)": its row's label. */
    label: string;
    /** The characters it is on, by name. */
    characters: string[];
    /** Is it on this character's list? */
    isOwn: boolean;
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
                    const isOwn = own.some((ownSpell) => isSameEntry(ownSpell, spell));
                    entry = this.describe(spell, isOwn, !own.some((ownSpell) => isSameSpell(ownSpell, spell)));
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

    private describe(spell: AddedSpell, isOwn: boolean, canAdd: boolean): CharacterSpell {
        const look = this.findLook(spell);
        const name = look.name ?? `#${spell.id}`;
        const icon = look.iconId;
        const picture = icon !== undefined ? `|T${icon}:${ICON_SIZE}|t ` : "";
        const label = `${picture}${name} (${this.readText(TYPE_TEXTS[spell.reminderType])})`;
        return { spell, name, label, characters: [], isOwn, canAdd };
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
        const toggle = this.createButton(row, CONTROL_LEFT, "BTN_ADD", () => this.toggleOnThisCharacter(index));
        const characters = this.createButton(row, CONTROL_LEFT + BUTTON_WIDTH + 6, "BTN_CHARACTERS", () => this.showCharacters(index));
        tab.addControl(row, {
            // A test's click: "characters", else Add or Remove
            apply: (value) => (value === "characters" ? this.showCharacters(index) : this.toggleOnThisCharacter(index)),
            refresh: () => {
                const entry = this.entries[index];
                if (entry === undefined) return;
                label?.SetText(entry.label);
                toggle.SetText(this.readText(entry.isOwn ? "BTN_REMOVE" : "BTN_ADD"));
                toggle.SetEnabled(entry.isOwn || entry.canAdd);
            },
            setEnabled: (isEnabled) => {
                toggle.SetEnabled(isEnabled);
                characters.SetEnabled(isEnabled);
            },
        }).showWhen(() => index < this.entries.length);
    }

    /** Which characters have it, and a button that deletes it from all of them. */
    private showCharacters(index: number): void {
        const entry = this.entries[index];
        if (entry === undefined) return;
        const listed = entry.characters.slice(0, MOST_LISTED);
        const unlisted = entry.characters.length - listed.length;
        if (unlisted > 0) listed.push(string.format(this.readText("ADDED_ON_MORE"), unlisted));
        const question = `${string.format(this.readText("ADDED_ON"), entry.name)}\n\n${listed.join("\n")}`;
        this.window?.confirm(question, this.readText("BTN_DELETE_ALL"), () => this.deleteEverywhere(entry.spell));
    }

    private toggleOnThisCharacter(index: number): void {
        const entry = this.entries[index];
        if (entry === undefined) return;
        if (!entry.isOwn) {
            this.addOnThisCharacter(entry);
            return;
        }
        // The last character's leaves the tab, so it cannot be added back here: asked first
        if (entry.characters.length > 1) this.removeFromThisCharacter(entry.spell);
        else {
            const question = string.format(this.readText("Q_REMOVE_LAST"), entry.name);
            this.window?.confirm(question, this.readText("BTN_REMOVE"), () => this.removeFromThisCharacter(entry.spell));
        }
    }

    private removeFromThisCharacter(spell: AddedSpell): void {
        const thisKey = this.settings.getCharacterKey();
        const own = this.settings.getOfCharacter(thisKey, "addedSpells") ?? [];
        this.settings.changeOfCharacter(
            thisKey,
            "addedSpells",
            own.filter((ownSpell) => !isSameEntry(ownSpell, spell)),
        );
        this.refresh();
    }

    private addOnThisCharacter(entry: CharacterSpell): void {
        if (!entry.canAdd) return;
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

    private deleteEverywhere(deleted: AddedSpell): void {
        for (const character of this.settings.listCharacters()) {
            const spells = this.settings.getOfCharacter(character.key, "addedSpells") ?? [];
            const kept = spells.filter((spell) => !isSameEntry(spell, deleted));
            if (kept.length !== spells.length) this.settings.changeOfCharacter(character.key, "addedSpells", kept);
        }
        this.refresh();
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

/** The same entry of a list: the ID and the type. */
function isSameEntry(a: AddedSpell, b: AddedSpell): boolean {
    return a.id === b.id && a.reminderType === b.reminderType;
}

/** The same spell, or the same item: a character keeps an ID once, apart from an item (low stock) of the same number. */
function isSameSpell(a: AddedSpell, b: AddedSpell): boolean {
    return a.id === b.id && (a.reminderType === "lowStock") === (b.reminderType === "lowStock");
}

function findItemIcon(itemId: number): number | undefined {
    const [didSucceed, icon] = pcall(C_Item.GetItemIconByID, itemId);
    return didSucceed ? (icon as number | undefined) : undefined;
}
