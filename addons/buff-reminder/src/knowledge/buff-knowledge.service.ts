// What the addon knows about buffs that the game does not say: which buffs count for each other
// (the buff categories), and how long a buff lasts. The toolkit's aura services are given it in their constructors.

import type { ClassBuffsService } from "../reminders/class-buffs.service";
import { OnEvent, buildAuraKey } from "@wowkit/core";
import type { AuraCategory, AuraKnowledge, SpellsService } from "@wowkit/wow";
import { BUFF_CATEGORIES, type BuffCategory } from "./buff-categories.constants";

export class BuffKnowledgeService implements AuraKnowledge {
    /** Aura key (the name in the client's language) -> its category; built from the spell IDs when first asked. */
    private categoryByName: LuaMap<string, BuffCategory> | undefined;

    constructor(
        private readonly classBuffs: ClassBuffsService,
        private readonly spells: SpellsService,
    ) {}

    @OnEvent("spells.invalidated")
    forgetCategoryNames(): void {
        this.categoryByName = undefined;
    }

    findCategory(name: string | undefined): AuraCategory | undefined {
        if (name === undefined || name === "") return undefined;
        return this.getCategoryNames().get(buildAuraKey(name));
    }

    getSeconds(spellId: number | undefined, name: string): number {
        return this.classBuffs.getBuffSeconds(spellId, name);
    }

    private getCategoryNames(): LuaMap<string, BuffCategory> {
        if (this.categoryByName) return this.categoryByName;
        const names = new LuaMap<string, BuffCategory>();
        for (const category of BUFF_CATEGORIES) {
            for (const spellId of category.members) {
                // The client's name first; the English hint is for an ID the client does not name
                this.addName(names, this.spells.getSpellName(spellId), category);
                this.addName(names, this.spells.getHintName(spellId), category);
            }
        }
        this.categoryByName = names;
        return names;
    }

    private addName(names: LuaMap<string, BuffCategory>, name: string | undefined, category: BuffCategory): void {
        if (name !== undefined && name !== "") names.set(buildAuraKey(name), category);
    }
}
