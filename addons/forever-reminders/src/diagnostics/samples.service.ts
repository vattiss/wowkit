// What to look at in debug mode: once a second, one sample of everything worth knowing, so that
// questions such as "can a buff be read in combat?" are answered with data from the game.

import type { BuffReminderService } from "../reminders/buff-reminder.service";
import type { ClassBuffsService } from "../reminders/class-buffs.service";
import type { PartyBuffsService } from "../reminders/party-buffs.service";
import type { ReagentsService } from "../reminders/reagents.service";
import type { WeaponChoiceService } from "../reminders/weapon/weapon-choice.service";
import type { WeaponReminderService } from "../reminders/weapon/weapon-reminder.service";
import type { ActionBarsService } from "@forever/wow";
import type { PartyService } from "@forever/wow";
import type { PlayerService } from "@forever/wow";
import { attempt, attemptMulti, isReadable } from "@forever/wow";
import type { SpellsService } from "@forever/wow";
import type { WeaponEnchantsService } from "@forever/wow";
import { MAIN_HAND_SLOT, OFF_HAND_SLOT } from "@forever/wow";
import type { RecorderService } from "./recorder.service";

/** The spellbook item type of a spell (1 = spell, 2 = not learned yet), "none" or "?". */
function getBookItemType(spellId: number): string {
    const [didSucceed, slot, bank] = attemptMulti(() => C_SpellBook.FindSpellBookSlotForSpell(spellId));
    if (!didSucceed || slot === undefined || bank === undefined) return "none";
    const info = attempt(C_SpellBook.GetSpellBookItemInfo, slot, bank);
    return info !== undefined && type(info) === "table" ? tostring(info.itemType) : "?";
}

function describeYesNo(answer: unknown): string {
    return answer === true ? "yes" : "no";
}

export class SamplesService {
    constructor(
        private readonly recorder: RecorderService,
        private readonly actionBars: ActionBarsService,
        private readonly party: PartyService,
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly enchants: WeaponEnchantsService,
        private readonly buffReminder: BuffReminderService,
        private readonly classBuffs: ClassBuffsService,
        private readonly partyBuffs: PartyBuffsService,
        private readonly reagents: ReagentsService,
        private readonly weaponChoice: WeaponChoiceService,
        private readonly weaponReminder: WeaponReminderService,
    ) {}

    /** One sample of everything worth knowing. */
    takeSample(): void {
        this.recorder.getStore().samples += 1;
        const context = this.recorder.getContext();
        this.recorder.recordProbe("C_UnitAuras buff 1 name,spellId,expirationTime", context, 3, () => {
            const aura = C_UnitAuras.GetAuraDataByIndex("player", 1, "HELPFUL");
            return [aura?.name, aura?.spellId, aura?.expirationTime];
        });
        this.recorder.recordProbe("UnitAffectingCombat(player)", context, 1, () => [UnitAffectingCombat("player")]);
        this.sampleNames();
        this.sampleBuffs(context);
        if (this.weaponChoice.getWeaponChoices().length > 0) this.sampleWeapon(context);
        this.sampleRanks(context);
        this.sampleForms(context);
        this.sampleParty(context);
        this.sampleReagents(context);
    }

    /** Why each buff is or is not asked for, how the client says it is known, where it would glow. */
    private sampleBuffs(context: string): void {
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            const id = this.spells.resolve(classBuff.id) ?? classBuff.id;
            const name = this.spells.getSpellName(id) ?? tostring(id);
            const check = this.buffReminder.checkBuff(classBuff);
            const state = check.isWanted ? `missing, usable=${tostring(this.spells.isCastable(id))}` : (check.why ?? "?");
            this.recorder.recordCount(`buff says | ${name}`, context, this.classBuffs.isBuffEnabled(classBuff) ? state : "switched off");
            this.recorder.recordCount(
                `known via | ${name}`,
                context,
                string.format(
                    "same id=%s known=%s inBookExact=%s inBook=%s itemType=%s resolved=%s",
                    tostring(id === classBuff.id),
                    describeYesNo(attempt(C_SpellBook.IsSpellKnown, classBuff.id)),
                    describeYesNo(attempt(C_SpellBook.IsSpellInSpellBook, classBuff.id, Enum.SpellBookSpellBank.Player, false)),
                    describeYesNo(attempt(C_SpellBook.IsSpellInSpellBook, classBuff.id)),
                    getBookItemType(classBuff.id),
                    tostring(this.spells.isLearned(classBuff.id)),
                ),
            );
            const buttons = this.actionBars.getButtonNamesOf(id);
            this.recorder.recordCount(`glows on buttons | ${name}`, context, buttons.length > 0 ? buttons.join(", ") : "none");
        }
    }

    /** The weapon enchant reads, raw and as the addon understands them. */
    private sampleWeapon(context: string): void {
        for (const slot of [MAIN_HAND_SLOT, OFF_HAND_SLOT]) {
            this.recorder.recordProbe(`C_PaperDollInfo.GetTemporaryEnchantmentInfo(${slot}) enchantID,remainingTimeMs`, context, 2, () => {
                const info = C_PaperDollInfo.GetTemporaryEnchantmentInfo(slot);
                return [info?.enchantID, info?.remainingTimeMs];
            });
        }
        for (const isOffhand of [false, true]) {
            const read = this.enchants.getWeaponEnchant(isOffhand);
            this.recorder.recordCount(
                `weapon enchant as the addon reads it | ${isOffhand ? "off hand" : "main hand"}`,
                context,
                `has=${tostring(read.has)} remain=${math.floor(read.remain)} id=${tostring(read.enchantId)}`,
            );
        }
        const reminder = this.weaponReminder.check();
        this.recorder.recordCount(
            "weapon reminder",
            context,
            reminder?.isNeeded ? (this.spells.getSpellName(reminder.spellId) ?? tostring(reminder.spellId)) : "nothing due",
        );
    }

    private sampleRanks(context: string): void {
        const names = this.actionBars.findOutdatedRanks().map((entry) => `${entry.name} ${entry.onBar}<${entry.best}`);
        this.recorder.recordCount("old ranks on the bars", context, names.length > 0 ? names.join(", ") : "none");
    }

    /** Can other units' auras be read (in combat, out of it)? Counts only: no names in the report. */
    private sampleParty(context: string): void {
        for (const unit of this.party.getPartyUnits()) {
            this.recorder.recordProbe(`C_UnitAuras ${unit} buff 1 name,spellId,sourceUnit`, context, 3, () => {
                const aura = C_UnitAuras.GetAuraDataByIndex(unit, 1, "HELPFUL");
                return [aura?.name, aura?.spellId, aura?.sourceUnit];
            });
        }
        const suggestions = this.partyBuffs.findPartyBuffSuggestions();
        const summary = suggestions.map((s) => `${this.spells.getSpellName(s.spellId) ?? tostring(s.spellId)} x${s.names.length}`);
        this.recorder.recordCount("party buffs suggested", context, summary.length > 0 ? summary.join(", ") : "none");
    }

    private sampleReagents(context: string): void {
        const low = this.reagents.findLowReagents().map((stock) => `${stock.name}=${stock.count}`);
        this.recorder.recordCount("reagents running low", context, low.length > 0 ? low.join(", ") : "none");
    }

    /** Shapeshift forms page the main bar: is the form bar readable in combat? */
    private sampleForms(context: string): void {
        const forms = attempt(GetNumShapeshiftForms);
        if (forms === undefined || !isReadable(forms) || forms < 1) return;
        for (let index = 1; index <= math.min(forms, 6); index++) {
            this.recorder.recordProbe(`GetShapeshiftFormInfo(${index}) icon,active,castable,spellID`, context, 4, () => [
                ...GetShapeshiftFormInfo(index),
            ]);
        }
    }

    /** The real names of the buffs on the player, out of combat only (in combat they are hidden). */
    private sampleNames(): void {
        if (this.player.isInCombat()) return;
        for (let i = 1; i <= 20; i++) {
            const aura = attempt(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL");
            if (!aura) return;
            this.recorder.recordText("buff on you", aura.name);
        }
    }
}
