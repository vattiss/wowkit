// The cooldowns of between fights were ready cooldowns before they had a type of their own (Utility cooldown): what the
// player set for one of them as a ready cooldown moves to its new type, once. A look is kept by the spell's name in the
// client's language (or its ID), so only the game can tell which looks are theirs: this runs as the addon is ready, not
// with the other moves of the saved settings. A spell the player added as a ready cooldown moves too, so it does not glow
// twice, once in each type.
import type { OnReady } from "@wowkit/core";
import type { SpellsService } from "@wowkit/wow";
import type { AddonSettingsService, AddedSpell, StyleOverride } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { UTILITY_COOLDOWNS } from "./glow-cues.constants";

export class UtilityLooksService implements OnReady {
    constructor(
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly styles: StyleService,
    ) {}

    onReady(): void {
        if (this.settings.get("areUtilityLooksMoved")) return;
        const names = new LuaSet<string>();
        for (const id of UTILITY_COOLDOWNS) {
            names.add(this.styles.getSpellKey(id));
            names.add(string.format("%d", id));
        }
        this.convertLooks(names);
        this.convertAdded(names);
        this.settings.change("areUtilityLooksMoved", true);
    }

    /** "readyCooldown:Cultivation" becomes "utilityCooldown:Cultivation", unless the new one is set already. */
    private convertLooks(names: LuaSet<string>): void {
        const looks = this.settings.get("spellStyles");
        const moved: { [key: string]: StyleOverride | undefined } = {};
        let isChanged = false;
        for (const [key, look] of pairs(looks)) {
            const [name] = string.match(key as string, "^readyCooldown:(.+)$");
            if (name === undefined || !names.has(name)) {
                moved[key as string] ??= look;
                continue;
            }
            moved[`utilityCooldown:${name}`] = looks[`utilityCooldown:${name}`] ?? look;
            isChanged = true;
        }
        if (isChanged) this.settings.change("spellStyles", moved);
    }

    /** An added ready cooldown of between fights becomes an added utility cooldown (once, if both were added). */
    private convertAdded(names: LuaSet<string>): void {
        const added = this.settings.get("addedSpells");
        const isOurs = (spell: AddedSpell) =>
            spell.reminderType === "readyCooldown" && names.has(this.spells.getSpellName(spell.id) ?? string.format("%d", spell.id));
        if (!added.some((spell) => isOurs(spell))) return;
        const moved: AddedSpell[] = [];
        for (const spell of added) {
            const next: AddedSpell = isOurs(spell) ? { id: spell.id, reminderType: "utilityCooldown" } : spell;
            if (!moved.some((other) => other.id === next.id && other.reminderType === next.reminderType)) moved.push(next);
        }
        this.settings.change("addedSpells", moved);
    }
}
