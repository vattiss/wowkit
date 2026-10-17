// What the addon knows about buffs that the game does not say: which buffs count for each other
// (the buff categories), and how long a buff lasts. The toolkit's aura services are given it in their constructors.

import type { ClassBuffsService } from "../reminders/class-buffs.service";
import { buildAuraKey, contains } from "@forever/framework";
import type { AuraCategory, AuraKnowledge } from "@forever/wow";
import { BUFF_CATEGORIES } from "./buff-categories.constants";

export class BuffKnowledgeService implements AuraKnowledge {
    constructor(private readonly classBuffs: ClassBuffsService) {}

    findCategory(name: string | undefined): AuraCategory | undefined {
        if (name === undefined || name === "") return undefined;
        const key = buildAuraKey(name);
        for (const category of BUFF_CATEGORIES) {
            for (const token of category.tokens) {
                if (contains(key, token)) return category;
            }
        }
        return undefined;
    }

    getSeconds(spellId: number | undefined, name: string): number {
        return this.classBuffs.getBuffSeconds(spellId, name);
    }
}
