// The look of a reminder: the default of its kind, what the player changed for the kind, and what the player changed for the
// spell, in that order of weight.
import type { Rgb, SpellsService } from "@wowkit/wow";
import { STYLE_DEFAULTS } from "./settings.constants";
import type { AddonSettingsService, ColorKey, Style, StyleOverride } from "./settings.interface";

export class StyleService {
    constructor(
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** The look of a kind of reminder, or of one spell of it: the spell's own, else the kind's, else the default. */
    getStyle(kind: ColorKey, spellId?: number): Style {
        const layers: StyleOverride[] = [
            spellId !== undefined ? this.getOverride(kind, spellId) : {},
            this.getOverride(kind),
            STYLE_DEFAULTS[kind],
        ];
        return {
            color: this.pickPart(layers, "color"),
            opacity: this.pickPart(layers, "opacity"),
            isTextOn: this.pickPart(layers, "isTextOn"),
            sound: this.pickPart(layers, "sound"),
        };
    }

    /** What the player changed for a kind or a spell (nothing inherited). */
    getOverride(kind: ColorKey, spellId?: number): StyleOverride {
        if (spellId === undefined) return this.settings.get("styles")[kind] ?? {};
        return this.settings.get("spellStyles")[this.getSpellKey(spellId)] ?? {};
    }

    /** Did the player change anything of the look of this kind or spell? */
    isOverridden(kind: ColorKey, spellId?: number): boolean {
        const override = this.getOverride(kind, spellId);
        return (
            override.color !== undefined ||
            override.opacity !== undefined ||
            override.isTextOn !== undefined ||
            override.sound !== undefined
        );
    }

    /** Changes part of the look of a kind (no spell) or of one spell. */
    changeStyle(kind: ColorKey, spellId: number | undefined, change: StyleOverride): void {
        const merged: StyleOverride = { ...this.getOverride(kind, spellId), ...change };
        if (spellId === undefined) {
            this.settings.change("styles", { ...this.settings.get("styles"), [kind]: merged });
        } else {
            this.settings.change("spellStyles", { ...this.settings.get("spellStyles"), [this.getSpellKey(spellId)]: merged });
        }
    }

    /** All the player's changes for the kind are forgotten: its spells follow the default again. */
    resetKind(kind: ColorKey): void {
        this.settings.change("styles", this.copyWithout(this.settings.get("styles"), kind));
    }

    /** All the player's changes for the spell are forgotten: it follows its kind again. */
    resetSpell(spellId: number): void {
        this.settings.change("spellStyles", this.copyWithout(this.settings.get("spellStyles"), this.getSpellKey(spellId)));
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
        return STYLE_DEFAULTS.buff[part];
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
}
