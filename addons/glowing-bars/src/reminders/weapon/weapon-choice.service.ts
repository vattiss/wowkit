// Which weapon buff the player should keep up: the player's pick if learned, else the best one
// already learned. A buff put on with an item (a rogue poison) counts as learned while an item of it is on the bars.
import { OnEvent, contains } from "@wowkit/core";
import type { AddonSettingsService } from "../../settings/settings.interface";
import type { ActionBarsService, BagsService, PlayerService, SpellsService } from "@wowkit/wow";
import type { PickedWeaponBuff } from "../reminders.interface";
import type { WeaponBuff } from "./weapon-buff.interface";
import { OFFHAND_PRIORITY, WEAPON_BUFF_BY_SPELL, WEAPON_BUFFS, WEAPON_PRIORITY } from "./weapon-buffs.constants";

export class WeaponChoiceService {
    private weaponNames: LuaSet<string> | undefined;
    private readonly tokenCache = new LuaMap<WeaponBuff, string[]>();

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly actionBars: ActionBarsService,
        private readonly bags: BagsService,
    ) {}

    @OnEvent("spells.invalidated")
    forgetNames(): void {
        this.weaponNames = undefined;
        for (const [entry] of this.tokenCache) this.tokenCache.delete(entry);
    }

    getWeaponChoices(): WeaponBuff[] {
        const token = this.player.getClassToken();
        return (token !== undefined ? WEAPON_BUFFS[token] : undefined) ?? [];
    }

    isWeaponBuffLearned(entry: WeaponBuff): boolean {
        return this.findUsableId(entry) !== undefined;
    }

    /** The class coats both weapons (rogue). */
    hasOffhandChoice(): boolean {
        const token = this.player.getClassToken();
        return token !== undefined && OFFHAND_PRIORITY[token] !== undefined;
    }

    /** The class coats both weapons and an off-hand weapon is equipped. */
    isCoatingBothWeapons(): boolean {
        return this.hasOffhandChoice() && this.player.isOffhandWeaponEquipped();
    }

    /** The automatic pick: the best weapon buff already learned. */
    findAutomaticWeaponBuff(isOffhand: boolean): PickedWeaponBuff | undefined {
        const choices = this.getWeaponChoices();
        const token = this.player.getClassToken();
        const order = token !== undefined ? (isOffhand ? OFFHAND_PRIORITY : WEAPON_PRIORITY)[token] : undefined;
        for (const key of order ?? []) {
            const found = this.createPickedWeaponBuff(choices.find((choice) => choice.key === key));
            if (found) return found;
        }
        for (const entry of choices) {
            const found = this.createPickedWeaponBuff(entry);
            if (found) return found;
        }
        return undefined;
    }

    /** The player's pick if it is learned, otherwise the automatic one. */
    findSelectedWeaponBuff(isOffhand = false): PickedWeaponBuff | undefined {
        const key = isOffhand ? this.settings.get("weaponBuffOff") : this.settings.get("weaponBuff");
        const chosen =
            key !== undefined && key !== "auto"
                ? this.createPickedWeaponBuff(this.getWeaponChoices().find((choice) => choice.key === key))
                : undefined;
        return chosen ?? this.findAutomaticWeaponBuff(isOffhand);
    }

    /** The weapon buff a cast put on, by spell ID, by a rank the table misses, or by the cast name. */
    findWeaponBuffForCast(spellId: number | undefined, castName: string | undefined): WeaponBuff | undefined {
        if (spellId !== undefined) {
            const entry = WEAPON_BUFF_BY_SPELL.get(spellId);
            if (entry) return entry;
            const name = this.spells.getSpellName(spellId);
            const selected = name !== undefined && this.getWeaponNameSet().has(name) ? this.findSelectedWeaponBuff()?.entry : undefined;
            if (selected) return selected;
        }
        if (castName !== undefined) return this.getWeaponChoices().find((choice) => this.doesMatchName(choice, castName));
        return undefined;
    }

    /** Lowercase texts that show the buff in a weapon tooltip. */
    getWeaponMatchTokens(entry: WeaponBuff): string[] {
        const cached = this.tokenCache.get(entry);
        if (cached) return cached;
        const tokens: string[] = [];
        const add = (token: string | undefined) => {
            if (token === undefined || token === "") return;
            const key = string.lower(token);
            if (!tokens.includes(key)) tokens.push(key);
        };
        for (const token of entry.match) add(token);
        for (const id of [entry.id, ...(entry.ranks ?? [])]) {
            add(this.spells.getSpellName(id));
            add(this.spells.getHintName(id));
        }
        this.tokenCache.set(entry, tokens);
        return tokens;
    }

    /**
     * The rank of a buff put on with an item that glows, as the spell the item casts: the highest on the bars that the
     * player has some of, else the highest on the bars; undefined with none on the bars.
     */
    private findItemRank(items: { item: number; spell: number }[]): number | undefined {
        const onBars = items.filter(({ spell }) => this.actionBars.isOnBars(spell));
        const owned = onBars.filter(({ item }) => this.bags.getItemCount(item) > 0);
        return (owned.length > 0 ? owned : onBars)[(owned.length > 0 ? owned : onBars).length - 1]?.spell;
    }

    /** The rank to cast of this weapon buff: of an item, the one on the bars; else the highest learned. */
    private findUsableId(entry: WeaponBuff | undefined): number | undefined {
        return entry?.items !== undefined ? this.findItemRank(entry.items) : this.findLearnedId(entry);
    }

    /** The highest learned rank of this weapon buff. */
    private findLearnedId(entry: WeaponBuff | undefined): number | undefined {
        if (!entry) return undefined;
        const ranks = entry.ranks ?? [];
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (this.spells.isLearned(ranks[i])) return ranks[i];
        }
        // The ID must still name this buff (a client can give an old ID to another spell); otherwise
        // the name decides (rogue poisons carry their name)
        if (
            this.spells.isLearned(entry.id) &&
            (entry.name === undefined || this.spells.getSpellName(this.spells.resolve(entry.id) ?? entry.id) === entry.name)
        ) {
            return entry.id;
        }
        if (entry.name !== undefined) {
            const byName = this.spells.resolveFromName(entry.name);
            if (byName !== undefined && this.spells.isLearned(byName)) return byName;
        }
        return undefined;
    }

    private createPickedWeaponBuff(entry: WeaponBuff | undefined): PickedWeaponBuff | undefined {
        const spellId = this.findUsableId(entry);
        return entry && spellId !== undefined ? { entry, spellId } : undefined;
    }

    private getWeaponNameSet(): LuaSet<string> {
        if (this.weaponNames && !this.weaponNames.isEmpty()) return this.weaponNames;
        this.weaponNames = new LuaSet();
        for (const [, list] of pairs(WEAPON_BUFFS)) {
            for (const entry of list ?? []) {
                const name = this.spells.getSpellName(entry.id);
                if (name !== undefined) this.weaponNames.add(name);
                if (entry.name !== undefined) this.weaponNames.add(entry.name);
            }
        }
        return this.weaponNames;
    }

    private doesMatchName(entry: WeaponBuff, name: string): boolean {
        const lower = string.lower(name);
        if (entry.match.some((token) => token !== "" && contains(lower, token))) return true;
        return [entry.id, ...(entry.ranks ?? [])].some((id) => {
            const spell = this.spells.getSpellName(id);
            return spell !== undefined && string.lower(spell) === lower;
        });
    }
}
