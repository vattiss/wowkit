// What kind of spell a spell is: helpful or harmful, a heal, a totem, a cue of its own (not a rotation step).
import { Hunter } from "@wowkit/wow-data";
import type { SpellDetailsService, SpellsService } from "@wowkit/wow";
import { TOTEMS, type TotemEntry } from "./class-data.constants";
import type { NameKeysService } from "./name-keys.service";
import { HEAL_SPELLS } from "./spell-data.constants";
import type { StepOptions } from "./step.interface";

export class SpellTraitsService {
    /** Name key -> totem entry; built from the spell IDs when first asked. */
    private totemsByName: LuaMap<string, TotemEntry> | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly nameKeys: NameKeysService,
    ) {}

    /** Cast on friends: a heal step, a known heal, or what the client marks helpful. */
    isHelpful(spellId: number, opt?: StepOptions): boolean {
        if (opt?.isHeal === true) return true;
        const id = this.spells.resolveOrSame(spellId);
        if (this.isKnownHeal(id) || this.isKnownHeal(spellId)) return true;
        return this.details.isHelpful(id);
    }

    isHarmful(spellId: number): boolean {
        return this.details.isHarmful(this.spells.resolveOrSame(spellId));
    }

    /** Only helpful: cast on the player or a friend, never on the enemy target. */
    isOnlyHelpful(spellId: number, opt?: StepOptions): boolean {
        return this.isHelpful(spellId, opt) && !this.isHarmful(spellId);
    }

    /** A heal: a heal step, or one of the known heals (by ID or by name). */
    isHealSpell(spellId: number | undefined, opt?: StepOptions): boolean {
        if (opt?.isHeal === true) return true;
        if (spellId === undefined) return false;
        return this.isKnownHeal(this.spells.resolveOrSame(spellId)) || this.isKnownHeal(spellId);
    }

    /** The totem entry of a spell (by ID, the ID the player knows, or name). */
    findTotem(spellId: number): TotemEntry | undefined {
        const resolved = this.spells.resolveOrSame(spellId);
        const byId = TOTEMS[resolved] ?? TOTEMS[spellId];
        if (byId) return byId;
        const key = this.nameKeys.findKeyOf(resolved) ?? this.nameKeys.findKeyOf(spellId);
        return key !== undefined ? this.getTotemsByName().get(key) : undefined;
    }

    /** Totems (worth dropping at a time) and the hunter's shots are cues of their own, never rotation steps. */
    isCueSpell(spellId: number): boolean {
        if (spellId === Hunter.AutoShot || spellId === Hunter.ConcussiveShot) return true;
        return this.findTotem(spellId)?.when !== undefined;
    }

    private isKnownHeal(spellId: number): boolean {
        return this.nameKeys.isOneOf(spellId, "heals", HEAL_SPELLS);
    }

    private getTotemsByName(): LuaMap<string, TotemEntry> {
        if (this.totemsByName && !this.totemsByName.isEmpty()) return this.totemsByName;
        const byName = new LuaMap<string, TotemEntry>();
        for (const [id, entry] of pairs(TOTEMS)) {
            const key = this.nameKeys.findKeyOf(id as number);
            if (key !== undefined && entry !== undefined) byName.set(key, entry);
        }
        this.totemsByName = byName;
        return byName;
    }
}
