// The rows of the table of looks: the six kinds of reminder (their default look), and the spells of the player's class that
// can have a look of their own: the buffs, the weapon buffs, the cooldowns, the procs, the group buffs with a reagent, and
// every spell of the book that has ranks. Plain lists; the window draws them.
import type { PlayerService, SpellsService } from "@wowkit/wow";
import { PROC_CUES } from "../glows/glow-cues.constants";
import type { GlowCuesService } from "../glows/glow-cues.service";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { ReagentsService } from "../reagents/reagents.service";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { WeaponChoiceService } from "../reminders/weapon/weapon-choice.service";
import { KIND_ORDER } from "../settings/settings.constants";
import type { ColorKey } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";

/** One row of the table: a kind (no spell), or a spell of a kind. */
export interface StyleRow {
    kind: ColorKey;
    spellId: number | undefined;
    label: string;
    /** The spell's icon; none for a kind. */
    iconId: number | undefined;
}

/** The words that name each kind of reminder. */
export const KIND_TEXTS: { [kind in ColorKey]: TextKey } = {
    buff: "KIND_BUFF",
    weapon: "KIND_WEAPON",
    cooldown: "KIND_COOLDOWN",
    proc: "KIND_PROC",
    rank: "KIND_RANK",
    reagent: "KIND_REAGENT",
};

export class StyleRowsService {
    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly classBuffs: ClassBuffsService,
        private readonly weaponChoice: WeaponChoiceService,
        private readonly reagents: ReagentsService,
        private readonly locale: AddonLocale,
        private readonly styles: StyleService,
        private readonly glowCues: GlowCuesService,
    ) {}

    /** The default look of each kind of reminder this character has spells of (a warrior has no weapon buff to remind of). */
    listKindRows(spellRows: StyleRow[]): StyleRow[] {
        return KIND_ORDER.filter((kind) => spellRows.some((row) => row.kind === kind)).map((kind) => ({
            kind,
            spellId: undefined,
            label: this.locale.getText(KIND_TEXTS[kind]),
            iconId: undefined,
        }));
    }

    /** The spells of the class that can have a look of their own, by kind, then by name. A spell is listed once. */
    listSpellRows(): StyleRow[] {
        const rows: StyleRow[] = [];
        const keys = new LuaSet<string>();
        const add = (kind: ColorKey, spellId: number | undefined) => {
            if (spellId === undefined) return;
            const key = this.styles.getSpellKey(spellId);
            if (keys.has(key)) return;
            keys.add(key);
            rows.push({
                kind,
                spellId,
                label: this.spells.getSpellLabel(spellId) ?? key,
                iconId: this.spells.getSpellInfo(spellId)?.iconID,
            });
        };
        const classToken = this.player.getClassToken() ?? "";
        for (const classBuff of this.classBuffs.getClassBuffs()) add("buff", classBuff.id);
        for (const entry of this.weaponChoice.getWeaponChoices()) add("weapon", entry.id);
        for (const id of this.glowCues.listCooldownIds()) add("cooldown", id);
        for (const id of PROC_CUES[classToken] ?? []) add("proc", id);
        for (const reagent of this.reagents.getReagentsOfClass(this.player.getClassToken())) add("reagent", reagent.spells[0]);
        // The spells that have ranks (a spell with one rank has no "Rank" in its subtext), on a bar or not
        for (const id of this.spells.listSpellBookIds()) if (this.spells.getSpellRank(id) !== undefined) add("rank", id);
        rows.sort((a, b) => this.compareRows(a, b));
        return rows;
    }

    private compareRows(a: StyleRow, b: StyleRow): number {
        const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
        if (byKind !== 0) return byKind;
        return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    }
}
