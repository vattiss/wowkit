// The look of a reminder: the default of its type, the spell's own default (a few have one), what the player changed for
// the type, and what the player changed for the spell, in that order of weight. What the player sets for a type reaches
// every spell of it, one with a default of its own too: that spell shows it is changed, and its Reset gives it back its own
// default, until the type is changed again. No spell keeps a default of its own hidden from the type's row. A spell's look
// belongs to one type of it: a buff that also has ranks keeps the quiet yellow of its old rank when the player colors the buff.
import type { Rgb, SpellsService } from "@wowkit/wow";
import { SPELL_STYLE_DEFAULTS, STYLE_DEFAULTS } from "./settings.constants";
import type { AddonSettingsService, MessageTextChoice, ReminderType, Style, StyleOverride } from "./settings.interface";

/** The parts of a look. */
const PARTS: (keyof Style)[] = [
    "color",
    "glowPercent",
    "isMessageOn",
    "sound",
    "repeat",
    "when",
    "glowTime",
    "animation",
    "messageTextChoice",
    "messageText",
    "messageColor",
    "messageShowFor",
];

/** The types whose message names what it is about by default: what to buy, or which button to change. */
const NAMED_TYPES: ReminderType[] = ["lowStock", "lowReagent", "oldRank", "totemGone"];

export class StyleService {
    /** Is this a spell whose look goes by its ID, not its name (see useOwnLooks)? */
    private hasOwnLook: (this: void, spellId: number) => boolean = () => false;
    /** The spell of the table's row of a weapon buff, for one of its ranks (see useWeaponBuffLooks). */
    private findWeaponBuffRow: (this: void, spellId: number) => number = (spellId) => spellId;
    /** The table's row of a totem's element (see useTotemLooks). */
    private findTotemRow: (this: void, spellId: number) => number = (spellId) => spellId;

    constructor(
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** Spells that share a name but are different things (foods, drinks) each keep a look of their own. */
    useOwnLooks(hasOwnLook: (this: void, spellId: number) => boolean): void {
        this.hasOwnLook = hasOwnLook;
    }

    /** The ranks of a poison or a stone each have a name of their own (Instant Poison II): their look is the one of the buff's row. */
    useWeaponBuffLooks(findWeaponBuffRow: (this: void, spellId: number) => number): void {
        this.findWeaponBuffRow = findWeaponBuffRow;
    }

    /** A totem's look is the one of its element's row: it holds whichever totem of that element the player drops. */
    useTotemLooks(findTotemRow: (this: void, spellId: number) => number): void {
        this.findTotemRow = findTotemRow;
    }

    /** The look of a type of reminder, or of one spell of it: the spell's own, else the type's, else the default. */
    getStyle(reminderType: ReminderType, rowSpellId?: number): Style {
        const spellId = reminderType === "totemGone" && rowSpellId !== undefined ? this.findTotemRow(rowSpellId) : rowSpellId;
        return this.buildStyle([
            spellId !== undefined ? this.getOverride(reminderType, spellId) : {},
            this.getOverride(reminderType),
            this.getSpellDefault(reminderType, spellId),
            STYLE_DEFAULTS[reminderType],
        ]);
    }

    /** The look the layers make, the first one that sets a part winning; the last layer is a default that sets every part. */
    private buildStyle(layers: StyleOverride[]): Style {
        return {
            color: this.pickPart(layers, "color"),
            glowPercent: this.pickPart(layers, "glowPercent"),
            isMessageOn: this.pickPart(layers, "isMessageOn"),
            sound: this.pickPart(layers, "sound"),
            repeat: this.pickPart(layers, "repeat"),
            when: this.pickPart(layers, "when"),
            glowTime: this.pickPart(layers, "glowTime"),
            animation: this.pickPart(layers, "animation"),
            messageTextChoice: this.pickPart(layers, "messageTextChoice"),
            messageText: this.pickPart(layers, "messageText"),
            messageColor: this.pickPart(layers, "messageColor"),
            messageShowFor: this.pickPart(layers, "messageShowFor"),
        };
    }

    /** What the message of a type or a spell says: what the player chose; else the item and its count, or the type alone. */
    getMessageTextChoice(reminderType: ReminderType, spellId: number | undefined): MessageTextChoice {
        const choice = this.getStyle(reminderType, spellId).messageTextChoice;
        return choice ?? (NAMED_TYPES.includes(reminderType) ? "typeAndName" : "typeOnly");
    }

    /** The spell's own default look, where it has one; the same for every rank (by name). */
    private getSpellDefault(reminderType: ReminderType, spellId: number | undefined): StyleOverride {
        const defaults = SPELL_STYLE_DEFAULTS[reminderType];
        if (defaults === undefined || spellId === undefined) return {};
        for (const [id, look] of pairs(defaults)) {
            const name = this.spells.getSpellName(spellId);
            if (id === spellId || (name !== undefined && this.spells.getSpellName(id as number) === name)) return look ?? {};
        }
        return {};
    }

    /** The look a spell has without what the player changed for it: the type's as the player set it, else its own default. */
    private getInheritedStyle(reminderType: ReminderType, spellId: number): Style {
        return this.buildStyle([this.getOverride(reminderType), this.getSpellDefault(reminderType, spellId), STYLE_DEFAULTS[reminderType]]);
    }

    /** The look a spell would have by its own default, before what the player set for its type: what its Reset gives back. */
    private getOwnStyle(reminderType: ReminderType, spellId: number): Style {
        return this.buildStyle([this.getSpellDefault(reminderType, spellId), this.getOverride(reminderType), STYLE_DEFAULTS[reminderType]]);
    }

    /** What the player changed for a type or a spell (nothing inherited). */
    getOverride(reminderType: ReminderType, spellId?: number): StyleOverride {
        if (spellId === undefined) return this.settings.get("styles")[reminderType] ?? {};
        return this.settings.get("spellStyles")[this.getStyleKey(reminderType, spellId)] ?? {};
    }

    /**
     * Is the look of this type or spell not its own default? A type the player changed; a spell the player changed, or one
     * whose own default the type's change has taken over.
     */
    isOverridden(reminderType: ReminderType, spellId?: number): boolean {
        if (spellId === undefined) {
            const override = this.getOverride(reminderType);
            return PARTS.some((part) => override[part] !== undefined);
        }
        const style = this.getStyle(reminderType, spellId);
        const own = this.getOwnStyle(reminderType, spellId);
        return PARTS.some((part) => !this.isSameValue(style[part], own[part]));
    }

    /**
     * Changes part of the look of a type (no spell) or of one spell. A part set to what it would inherit anyway is not
     * kept: it follows the type (or the default) again.
     */
    changeStyle(reminderType: ReminderType, spellId: number | undefined, change: StyleOverride): void {
        const inherited = spellId === undefined ? STYLE_DEFAULTS[reminderType] : this.getInheritedStyle(reminderType, spellId);
        const merged: StyleOverride = { ...this.getOverride(reminderType, spellId) };
        for (const part of PARTS) {
            const value = change[part];
            if (value === undefined) continue;
            // A type set to its default is kept all the same where a spell has another default of its own: it reaches that one too
            const isKept = spellId === undefined && this.hasOtherOwnDefault(reminderType, part, value);
            if (value === "" || (this.isSameValue(value, inherited[part]) && !isKept)) delete merged[part];
            else (merged as Record<string, unknown>)[part] = value;
        }
        this.saveOverride(reminderType, spellId, merged);
        if (spellId === undefined)
            this.releaseOwnDefaults(
                reminderType,
                PARTS.filter((part) => change[part] !== undefined),
            );
    }

    /** A part follows what it inherits again (a message that takes the color of its glow). */
    resetPart(reminderType: ReminderType, spellId: number | undefined, part: keyof Style): void {
        const merged: StyleOverride = { ...this.getOverride(reminderType, spellId) };
        delete merged[part];
        this.saveOverride(reminderType, spellId, merged);
        if (spellId === undefined) this.releaseOwnDefaults(reminderType, [part]);
    }

    /** Has a spell of the type a default of its own for this part, other than this value? */
    private hasOtherOwnDefault(reminderType: ReminderType, part: keyof Style, value: unknown): boolean {
        for (const [, look] of pairs(SPELL_STYLE_DEFAULTS[reminderType] ?? {})) {
            if (look?.[part] !== undefined && !this.isSameValue(look[part], value)) return true;
        }
        return false;
    }

    /**
     * The type's parts changed: a spell that holds its own default in them (its Reset put it there) follows the type again.
     * What the player chose otherwise for the spell stays.
     */
    private releaseOwnDefaults(reminderType: ReminderType, parts: (keyof Style)[]): void {
        const spellStyles = this.settings.get("spellStyles");
        let changed: typeof spellStyles | undefined;
        for (const [id, look] of pairs(SPELL_STYLE_DEFAULTS[reminderType] ?? {})) {
            const key = this.getStyleKey(reminderType, id as number);
            const override = (changed ?? spellStyles)[key];
            if (override === undefined || look === undefined) continue;
            const kept: StyleOverride = { ...override };
            for (const part of parts) if (look[part] !== undefined && this.isSameValue(kept[part], look[part])) delete kept[part];
            changed = this.copyWithout(changed ?? spellStyles, key);
            if (PARTS.some((part) => kept[part] !== undefined)) changed[key] = kept;
        }
        if (changed !== undefined) this.settings.change("spellStyles", changed);
    }

    private saveOverride(reminderType: ReminderType, spellId: number | undefined, merged: StyleOverride): void {
        const isEmpty = !PARTS.some((part) => merged[part] !== undefined);
        if (spellId === undefined) {
            const styles = this.copyWithout(this.settings.get("styles"), reminderType);
            if (!isEmpty) styles[reminderType] = merged;
            this.settings.change("styles", styles);
        } else {
            const key = this.getStyleKey(reminderType, spellId);
            const spellStyles = this.copyWithout(this.settings.get("spellStyles"), key);
            if (!isEmpty) spellStyles[key] = merged;
            this.settings.change("spellStyles", spellStyles);
        }
    }

    /** All the player's changes for the type are forgotten: its spells follow the default again. */
    resetType(reminderType: ReminderType): void {
        const changedParts = PARTS.filter((part) => this.getOverride(reminderType)[part] !== undefined);
        this.settings.change("styles", this.copyWithout(this.settings.get("styles"), reminderType));
        this.releaseOwnDefaults(reminderType, changedParts);
    }

    /**
     * All the player's changes for the spell in this type are forgotten: it follows the type again, or, where it has a
     * default of its own the type's change took over, it has that again (until the type is changed again).
     */
    resetSpell(reminderType: ReminderType, spellId: number): void {
        const own = this.getSpellDefault(reminderType, spellId);
        const typeOverride = this.getOverride(reminderType);
        const kept: StyleOverride = {};
        for (const part of PARTS) {
            const value = own[part];
            const typeValue = typeOverride[part];
            if (value !== undefined && typeValue !== undefined && !this.isSameValue(value, typeValue)) {
                (kept as Record<string, unknown>)[part] = value;
            }
        }
        this.saveOverride(reminderType, spellId, kept);
    }

    /** A spell is told apart by its name, so a new rank keeps what the player chose. */
    getSpellKey(spellId: number): string {
        return this.spells.getSpellName(spellId) ?? string.format("%d", spellId);
    }

    /** The text in a color (|cffRRGGBB ... |r). */
    applyTextColor(color: Rgb, text: string): string {
        const [r, g, b] = color;
        return string.format("|cff%02x%02x%02x%s|r", math.floor(r * 255 + 0.5), math.floor(g * 255 + 0.5), math.floor(b * 255 + 0.5), text);
    }

    /** The key of a spell's look: its type and its name ("rank:Smite"). */
    private getStyleKey(reminderType: ReminderType, spellId: number): string {
        const id =
            reminderType === "weaponBuff"
                ? this.findWeaponBuffRow(spellId)
                : reminderType === "totemGone"
                  ? this.findTotemRow(spellId)
                  : spellId;
        return `${reminderType}:${this.hasOwnLook(id) ? string.format("%d", id) : this.getSpellKey(id)}`;
    }

    private isSameValue(a: unknown, b: unknown): boolean {
        if (type(a) === "table" && type(b) === "table") return (a as number[]).join(",") === (b as number[]).join(",");
        return a === b;
    }

    /** The table without one of its entries (an entry set to undefined in a copy is still the old one). */
    private copyWithout<V>(entries: { [key: string]: V | undefined }, key: string): { [key: string]: V | undefined } {
        const copy: { [key: string]: V | undefined } = {};
        for (const [name, value] of pairs(entries)) if (name !== key) copy[name as string] = value;
        return copy;
    }

    /** The first layer that sets the part; the last layer is the default, which sets every part. */
    private pickPart<K extends keyof Style>(layers: StyleOverride[], part: K): Style[K] {
        for (const layer of layers) {
            const value = layer[part];
            if (value !== undefined) return value as Style[K];
        }
        return STYLE_DEFAULTS.missingBuff[part];
    }
}
