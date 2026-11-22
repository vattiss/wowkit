// What the addon knows about buffs that the game does not say: which buffs count for each other
// (the buff categories), which are shapeshift forms, and how long a buff lasts. The names come from the client by
// spell ID, so they hold in every language.

import type { ClassBuffsService } from "../reminders/class-buffs.service";
import { OnEvent } from "@wowkit/core";
import { type SpellsService, buildNameKey } from "@wowkit/wow";
import { Druid } from "@wowkit/wow-data";
import { BUFF_CATEGORIES, type BuffCategory } from "./buff-categories.constants";

/** The shapeshift forms: they have no end, and change only with a shapeshift. */
const FORMS = [Druid.BearForm, Druid.DireBearForm, Druid.CatForm, Druid.TravelForm, Druid.AquaticForm, Druid.Moonkin];

export class BuffKnowledgeService {
    /** Aura key (the name in the client's language) -> its category; built from the spell IDs when first asked. */
    private categoryByName: LuaMap<string, BuffCategory> | undefined;
    /** Listed spell IDs -> their category, independent of the client's translation. */
    private readonly categoryById = new LuaMap<number, BuffCategory>();
    /** The aura keys of the shapeshift forms, in the client's language. */
    private formKeys: LuaSet<string> | undefined;
    /** The spells the player added to a category (see useAddedMembers). */
    private addedMembers: number[] = [];

    constructor(
        private readonly classBuffs: ClassBuffsService,
        private readonly spells: SpellsService,
    ) {
        for (const category of BUFF_CATEGORIES) {
            for (const spellId of category.members) this.categoryById.set(spellId, category);
        }
    }

    @OnEvent("spells.invalidated")
    forgetNames(): void {
        this.categoryByName = undefined;
        this.formKeys = undefined;
    }

    /**
     * The spells the player added to a category's type (seals of their own), in place of those added before: they count for
     * the category, and last as long.
     */
    useAddedMembers(categoryKey: string, spellIds: number[]): void {
        const category = BUFF_CATEGORIES.find((candidate) => candidate.key === categoryKey);
        if (category === undefined) return;
        const kept = this.addedMembers.filter((id) => this.categoryById.get(id) !== category);
        for (const id of this.addedMembers) if (!kept.includes(id)) this.categoryById.delete(id);
        for (const id of spellIds) if (!category.members.includes(id)) this.categoryById.set(id, category);
        this.addedMembers = [...kept, ...spellIds.filter((id) => !category.members.includes(id))];
        // The names are worked out again when next asked
        this.categoryByName = undefined;
    }

    /** The category a buff belongs to: a listed ID first, then its name in the client's language. */
    findCategory(name: string | undefined, spellId?: number): BuffCategory | undefined {
        const category = spellId !== undefined ? this.categoryById.get(spellId) : undefined;
        if (category !== undefined) return category;
        if (name === undefined || name === "") return undefined;
        return this.getCategoryNames().get(buildNameKey(name));
    }

    /** Is this aura key (buildNameKey of a name) a shapeshift form? */
    isFormKey(key: string): boolean {
        if (!this.formKeys) {
            this.formKeys = new LuaSet();
            for (const spellId of FORMS) {
                for (const name of this.listNames(spellId)) this.formKeys.add(buildNameKey(name));
            }
        }
        return this.formKeys.has(key);
    }

    /** How long a buff outside the categories lasts (seconds), when the class buff list says; undefined when it is not known. */
    findSeconds(spellId: number | undefined, name: string): number | undefined {
        return this.classBuffs.findBuffSeconds(spellId, name);
    }

    /** Does the buff fall off with death for sure: a class buff, or of a category (an aspect, an aura, a tracking...)? */
    isLostOnDeath(spellId: number | undefined, name: string): boolean {
        return this.findCategory(name, spellId) !== undefined || this.classBuffs.isClassBuff(spellId, name);
    }

    private getCategoryNames(): LuaMap<string, BuffCategory> {
        if (this.categoryByName) return this.categoryByName;
        const names = new LuaMap<string, BuffCategory>();
        for (const category of BUFF_CATEGORIES) {
            for (const spellId of category.members) {
                for (const name of this.listNames(spellId)) names.set(buildNameKey(name), category);
            }
        }
        for (const spellId of this.addedMembers) {
            const category = this.categoryById.get(spellId);
            if (category !== undefined) for (const name of this.listNames(spellId)) names.set(buildNameKey(name), category);
        }
        this.categoryByName = names;
        return names;
    }

    /** The client's name of a spell, and the English hint for an ID the client does not name. */
    private listNames(spellId: number): string[] {
        const names: string[] = [];
        const clientName = this.spells.getSpellName(spellId);
        const hintName = this.spells.getHintName(spellId);
        if (clientName !== undefined && clientName !== "") names.push(clientName);
        if (hintName !== undefined && hintName !== "") names.push(hintName);
        return names;
    }
}
