// The cooldowns of between fights were ready cooldowns before they had a type of their own (Utility cooldown): what the
// player set for one of them as a ready cooldown moves to its new type, once for each, also for one made a utility
// cooldown later (Shadowmeld). A look is kept by the spell's name in the client's language (or its ID), so only the game
// can tell which looks are theirs: this runs as the addon is ready, not with the other moves of the saved settings. A
// spell the player added as a ready cooldown moves too, so it does not glow twice, once in each type. One whose name the
// client does not give yet is left for the next time.
import type { OnReady } from "@wowkit/core";
import type { SpellsService } from "@wowkit/wow";
import type { AddonSettingsService, AddedSpell, StyleOverride } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { Racial, Shaman, Travel } from "@wowkit/wow-data";
import { UTILITY_COOLDOWNS } from "./glow-cues.constants";

/** The utility cooldowns the first move knew (areUtilityLooksMoved): a player it ran for has them moved already. */
const FIRST_UTILITY_COOLDOWNS = [
    Racial.Cultivation,
    Racial.Cannibalize,
    Racial.RapidRegeneration,
    Racial.ReadLeyline,
    Racial.Skysight,
    Racial.WalkOnAir,
    Shaman.AstralRecall,
    Travel.Hearthstone,
];

export class UtilityLooksService implements OnReady {
    constructor(
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly styles: StyleService,
    ) {}

    onReady(): void {
        const moved = this.settings.get("movedUtilityCooldowns");
        // Those the first move took care of are not moved again: what the player set since is theirs
        const isFirstMoveDone = this.settings.get("areUtilityLooksMoved");
        const due = UTILITY_COOLDOWNS.filter(
            (id) =>
                moved[string.format("%d", id)] !== true &&
                !(isFirstMoveDone && FIRST_UTILITY_COOLDOWNS.includes(id)) &&
                this.spells.getSpellName(id) !== undefined,
        );
        if (due.length === 0) return;
        const names = new LuaSet<string>();
        for (const id of due) {
            names.add(this.styles.getSpellKey(id));
            names.add(string.format("%d", id));
        }
        this.convertLooks(names);
        this.convertAdded(names);
        const done = { ...moved };
        for (const id of due) done[string.format("%d", id)] = true;
        this.settings.change("movedUtilityCooldowns", done);
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
