// What to look at in debug mode: once a second, one sample of everything worth knowing, so that
// questions such as "can a buff be read in combat?" are answered with data from the game.
import { findOutdatedRanks, getButtonNamesOf } from "../../wow/action-bars";
import { getPartyUnits } from "../../wow/party";
import { isInCombat } from "../../wow/player";
import { attempt, attemptMulti, isReadable } from "../../wow/safe";
import { getSpellName, isCastable, isLearned, resolve } from "../../wow/spells";
import { getWeaponEnchant } from "../../wow/weapon-enchants";
import { checkBuff } from "../../reminders/buff-reminder";
import { getClassBuffs, isBuffEnabled } from "../../reminders/class-buffs";
import { findPartyBuffSuggestions } from "../../reminders/party-buffs";
import { findLowReagents } from "../../reminders/reagents";
import { getWeaponChoices } from "../../reminders/weapon-choice";
import { weaponReminder } from "../../reminders/weapon-reminder";
import { MAIN_HAND_SLOT, OFF_HAND_SLOT } from "../../constants";
import { getContext, getStore, recordCount, recordProbe, recordText } from "./recorder";

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

/** Why each buff is or is not asked for, how the client says it is known, where it would glow. */
function sampleBuffs(context: string): void {
    for (const classBuff of getClassBuffs()) {
        const id = resolve(classBuff.id) ?? classBuff.id;
        const name = getSpellName(id) ?? tostring(id);
        const check = checkBuff(classBuff);
        const state = check.isWanted ? `missing, usable=${tostring(isCastable(id))}` : (check.why ?? "?");
        recordCount(`buff says | ${name}`, context, isBuffEnabled(classBuff) ? state : "switched off");
        recordCount(
            `known via | ${name}`,
            context,
            string.format(
                "same id=%s known=%s inBookExact=%s inBook=%s itemType=%s resolved=%s",
                tostring(id === classBuff.id),
                describeYesNo(attempt(C_SpellBook.IsSpellKnown, classBuff.id)),
                describeYesNo(attempt(C_SpellBook.IsSpellInSpellBook, classBuff.id, Enum.SpellBookSpellBank.Player, false)),
                describeYesNo(attempt(C_SpellBook.IsSpellInSpellBook, classBuff.id)),
                getBookItemType(classBuff.id),
                tostring(isLearned(classBuff.id)),
            ),
        );
        const buttons = getButtonNamesOf(id);
        recordCount(`glows on buttons | ${name}`, context, buttons.length > 0 ? buttons.join(", ") : "none");
    }
}

/** The weapon enchant reads, raw and as the addon understands them. */
function sampleWeapon(context: string): void {
    for (const slot of [MAIN_HAND_SLOT, OFF_HAND_SLOT]) {
        recordProbe(`C_PaperDollInfo.GetTemporaryEnchantmentInfo(${slot}) enchantID,remainingTimeMs`, context, 2, () => {
            const info = C_PaperDollInfo.GetTemporaryEnchantmentInfo(slot);
            return [info?.enchantID, info?.remainingTimeMs];
        });
    }
    for (const isOffhand of [false, true]) {
        const read = getWeaponEnchant(isOffhand);
        recordCount(
            `weapon enchant as the addon reads it | ${isOffhand ? "off hand" : "main hand"}`,
            context,
            `has=${tostring(read.has)} remain=${math.floor(read.remain)} id=${tostring(read.enchantId)}`,
        );
    }
    const reminder = weaponReminder.check();
    recordCount("weapon reminder", context, reminder?.isNeeded ? (getSpellName(reminder.spellId) ?? tostring(reminder.spellId)) : "nothing due");
}

function sampleRanks(context: string): void {
    const names = findOutdatedRanks().map((entry) => `${entry.name} ${entry.onBar}<${entry.best}`);
    recordCount("old ranks on the bars", context, names.length > 0 ? names.join(", ") : "none");
}

/** Can other units' auras be read (in combat, out of it)? Counts only: no names in the report. */
function sampleParty(context: string): void {
    for (const unit of getPartyUnits()) {
        recordProbe(`C_UnitAuras ${unit} buff 1 name,spellId,sourceUnit`, context, 3, () => {
            const aura = C_UnitAuras.GetAuraDataByIndex(unit, 1, "HELPFUL");
            return [aura?.name, aura?.spellId, aura?.sourceUnit];
        });
    }
    const suggestions = findPartyBuffSuggestions();
    const summary = suggestions.map((s) => `${getSpellName(s.spellId) ?? tostring(s.spellId)} x${s.names.length}`);
    recordCount("party buffs suggested", context, summary.length > 0 ? summary.join(", ") : "none");
}

function sampleReagents(context: string): void {
    const low = findLowReagents().map((stock) => `${stock.name}=${stock.count}`);
    recordCount("reagents running low", context, low.length > 0 ? low.join(", ") : "none");
}

/** Shapeshift forms page the main bar: is the form bar readable in combat? */
function sampleForms(context: string): void {
    const forms = attempt(GetNumShapeshiftForms);
    if (forms === undefined || !isReadable(forms) || forms < 1) return;
    for (let index = 1; index <= math.min(forms, 6); index++) {
        recordProbe(`GetShapeshiftFormInfo(${index}) icon,active,castable,spellID`, context, 4, () => [...GetShapeshiftFormInfo(index)]);
    }
}

/** The real names of the buffs on the player, out of combat only (in combat they are hidden). */
function sampleNames(): void {
    if (isInCombat()) return;
    for (let i = 1; i <= 20; i++) {
        const aura = attempt(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL");
        if (!aura) return;
        recordText("buff on you", aura.name);
    }
}

/** One sample of everything worth knowing. */
export function takeSample(): void {
    getStore().samples += 1;
    const context = getContext();
    recordProbe("C_UnitAuras buff 1 name,spellId,expirationTime", context, 3, () => {
        const aura = C_UnitAuras.GetAuraDataByIndex("player", 1, "HELPFUL");
        return [aura?.name, aura?.spellId, aura?.expirationTime];
    });
    recordProbe("UnitAffectingCombat(player)", context, 1, () => [UnitAffectingCombat("player")]);
    sampleNames();
    sampleBuffs(context);
    if (getWeaponChoices().length > 0) sampleWeapon(context);
    sampleRanks(context);
    sampleForms(context);
    sampleParty(context);
    sampleReagents(context);
}
