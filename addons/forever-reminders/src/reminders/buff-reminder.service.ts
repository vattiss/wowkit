// Which buffs of the class list are missing.

import type { ActionBarsService, AurasService, PlayerService, SpellsService } from "@forever/wow";
import type { ClassBuff } from "./class-buff.interface";
import type { ClassBuffsService } from "./class-buffs.service";
import type { BuffCheck, MissingBuffs } from "./reminders.interface";

export class BuffReminderService {
    constructor(
        private readonly auras: AurasService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly actionBars: ActionBarsService,
        private readonly classBuffs: ClassBuffsService,
    ) {}

    /** Is this buff worth asking for now? */
    checkBuff(classBuff: ClassBuff): BuffCheck {
        const id = this.spells.resolve(classBuff.id);
        if (id === undefined || !this.spells.isLearned(id)) return { isWanted: false, why: "not learned yet" };
        if (classBuff.isSwimmingOnly && !this.player.isSwimming()) return { isWanted: false, why: "only while swimming" };
        for (const other of classBuff.categoryMembers ?? []) {
            if (this.auras.hasAura(other)) return { isWanted: false, why: "a buff from the same category is already up" };
        }
        // hasAura reads the aura, and falls back on what was seen or cast while the client hides auras
        if (this.auras.hasAura(id)) return { isWanted: false, why: "already active" };
        return { isWanted: true };
    }

    /**
     * Looks at the buffs of the list out of combat, whether or not a reminder is due, so the aura
     * memory knows them: a buff put on in town still counts once the client hides auras.
     */
    rememberSelfBuffs(): void {
        if (this.player.isInCombat()) return;
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            if (this.classBuffs.isBuffEnabled(classBuff)) {
                const id = this.spells.resolve(classBuff.id);
                if (id !== undefined) this.auras.hasAura(id);
            }
        }
    }

    /**
     * The missing buffs in list order. Of a category (one aspect, one paladin aura) one is enough: the
     * first member on the bars glows; when a member is on the bars nothing of the category is named in
     * the "not on your bars" message, else the first one.
     */
    findMissingBuffs(): MissingBuffs {
        const glow: number[] = [];
        const glowCategories = new LuaSet<object>();
        const candidates: { id: number; category: object }[] = [];
        const categoryOnBars = new LuaSet<object>();
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            if (this.classBuffs.isBuffEnabled(classBuff) && this.checkBuff(classBuff).isWanted) {
                const id = this.spells.resolve(classBuff.id) ?? classBuff.id;
                const category = classBuff.categoryMembers ?? classBuff;
                if (this.actionBars.isOnBars(id)) {
                    // Only a buff that can be cast now glows (Battle Shout waits for rage); one the
                    // client gives no answer about still does
                    if (this.spells.isCastable(id) !== false && !glowCategories.has(category)) {
                        glowCategories.add(category);
                        glow.push(id);
                    }
                    categoryOnBars.add(category);
                } else {
                    candidates.push({ id, category });
                }
            }
        }
        const notOnBars: number[] = [];
        const named = new LuaSet<object>();
        for (const candidate of candidates) {
            if (!categoryOnBars.has(candidate.category) && !named.has(candidate.category)) {
                named.add(candidate.category);
                notOnBars.push(candidate.id);
            }
        }
        return { glow, notOnBars };
    }
}
