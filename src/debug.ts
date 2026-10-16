// Debug mode: samples what the client really answers (secret, nil, a value, an error) once a
// second and counts the events it really sends, so questions such as "can a buff be read in
// combat?" are answered with data from the game instead of guesses. Nothing is printed: the
// counts live in the saved settings, and report() turns them into text.
import { buttonNamesFor, oldRanksOnBars } from "./action-bars";
import { known, resolve, spellName, spellUsable } from "./api/spells";
import { inCombat, partyUnits } from "./api/unit";
import { weaponEnchant } from "./api/weapon";
import { checkBuff } from "./buff-reminder";
import { classBuffs, classToken, isBuffEnabled } from "./buffs";
import { MAIN_HAND_SLOT, OFF_HAND_SLOT } from "./constants";
import { partyBuffSuggestions } from "./party-buffs";
import { lowReagents } from "./reagents";
import { settingChanged, settings, type DebugStore } from "./settings";
import { attempt, attemptMulti, readable, swallowedError } from "./util/safe";
import { weaponChoices } from "./weapon-choice";
import { weaponReminder } from "./weapon-reminder";

const MAX_KEYS = 700;
const MAX_TEXTS = 150;
const SAMPLE_SECONDS = 1;

let ticker: TimerHandle | undefined;
let addonName = "";

/** Call once with this addon's folder name. */
export function init(name: string): void {
    addonName = name;
    settingChanged.listen((key) => {
        if (key === "debugMode") apply();
    });
    // Errors the addon swallowed on purpose: counted, so our own bugs do not stay hidden
    swallowedError.listen((message) => {
        if (settings.debugMode) countText("swallowed error", message);
    });
}
let eventFrame: Frame | undefined;

function store(): DebugStore {
    settings.debug ??= { counts: {}, texts: {}, keys: 0, textKeys: 0, dropped: 0, samples: 0 };
    return settings.debug;
}

/** "number", "SECRET number", "nil", "boolean=true": what kind of value came back. */
function classify(value: unknown): string {
    if (value === undefined) return "nil";
    const kind = type(value);
    if (issecretvalue(value)) return `SECRET ${kind}`;
    if (kind === "boolean") return `boolean=${tostring(value)}`;
    return kind;
}

function count(probe: string, context: string, result: string): void {
    const d = store();
    const key = `${probe}\t${context}\t${result}`;
    if (d.counts[key] === undefined) {
        if (d.keys >= MAX_KEYS) {
            d.dropped += 1;
            return;
        }
        d.keys += 1;
        d.counts[key] = 0;
    }
    d.counts[key] += 1;
}

/** Short texts the client sends (error messages): the exact wording matters. */
function countText(label: string, message: unknown): void {
    if (type(message) !== "string" || !readable(message)) return;
    const d = store();
    const key = `${label}: ${string.sub(message as string, 1, 80)}`;
    if (d.texts[key] === undefined) {
        if (d.textKeys >= MAX_TEXTS) return;
        d.textKeys += 1;
        d.texts[key] = 0;
    }
    d.texts[key] += 1;
}

function context(): string {
    return inCombat() ? "combat" : "idle";
}

/** Calls `fn` (which returns `arity` values) and counts the kinds of values it returned. */
function probe(name: string, ctx: string, arity: number, fn: (this: void) => unknown[]): void {
    const [ok, values] = pcall(fn);
    let result: string;
    if (!ok) {
        result = `ERROR ${string.sub(tostring(values), 1, 70)}`;
    } else {
        const parts: string[] = [];
        for (let i = 0; i < arity; i++) parts.push(classify((values as unknown[])[i]));
        result = parts.join(",");
    }
    count(name, ctx, result);
}

/** The spellbook item type of a spell (1 = spell, 2 = not learned yet), "none" or "?". */
function bookItemType(spellId: number): string {
    const [ok, slot, bank] = attemptMulti(() => C_SpellBook.FindSpellBookSlotForSpell(spellId));
    if (!ok || slot === undefined || bank === undefined) return "none";
    const info = attempt(C_SpellBook.GetSpellBookItemInfo, slot, bank);
    return info !== undefined && type(info) === "table" ? tostring(info.itemType) : "?";
}

function yes(answer: unknown): string {
    return answer === true ? "yes" : "no";
}

/** Why each buff is or is not asked for, how the client says it is known, where it would glow. */
function sampleBuffs(ctx: string): void {
    for (const step of classBuffs()) {
        const id = resolve(step.id) ?? step.id;
        const name = spellName(id) ?? tostring(id);
        const check = checkBuff(step);
        const state = check.wanted ? `missing, usable=${tostring(spellUsable(id))}` : (check.why ?? "?");
        count(`buff says | ${name}`, ctx, isBuffEnabled(step) ? state : "switched off");
        count(
            `known via | ${name}`,
            ctx,
            string.format(
                "same id=%s known=%s inBookExact=%s inBook=%s itemType=%s resolved=%s",
                tostring(id === step.id),
                yes(attempt(C_SpellBook.IsSpellKnown, step.id)),
                yes(attempt(C_SpellBook.IsSpellInSpellBook, step.id, Enum.SpellBookSpellBank.Player, false)),
                yes(attempt(C_SpellBook.IsSpellInSpellBook, step.id)),
                bookItemType(step.id),
                tostring(known(step.id)),
            ),
        );
        const buttons = buttonNamesFor(id);
        count(`glows on buttons | ${name}`, ctx, buttons.length > 0 ? buttons.join(", ") : "none");
    }
}

/** The weapon enchant reads, raw and as the addon understands them. */
function sampleWeapon(ctx: string): void {
    for (const slot of [MAIN_HAND_SLOT, OFF_HAND_SLOT]) {
        probe(`C_PaperDollInfo.GetTemporaryEnchantmentInfo(${slot}) enchantID,remainingTimeMs`, ctx, 2, () => {
            const info = C_PaperDollInfo.GetTemporaryEnchantmentInfo(slot);
            return [info?.enchantID, info?.remainingTimeMs];
        });
    }
    for (const offhand of [false, true]) {
        const read = weaponEnchant(offhand);
        count(
            `weapon enchant as the addon reads it | ${offhand ? "off hand" : "main hand"}`,
            ctx,
            `has=${tostring(read.has)} remain=${math.floor(read.remain)} id=${tostring(read.enchantId)}`,
        );
    }
    const reminder = weaponReminder.check();
    count("weapon reminder", ctx, reminder?.need ? (spellName(reminder.spellId) ?? tostring(reminder.spellId)) : "nothing due");
}

function sampleRanks(ctx: string): void {
    const names = oldRanksOnBars().map((entry) => `${entry.name} ${entry.onBar}<${entry.best}`);
    count("old ranks on the bars", ctx, names.length > 0 ? names.join(", ") : "none");
}

/** Can other units' auras be read (in combat, out of it)? Counts only: no names in the report. */
function sampleParty(ctx: string): void {
    for (const unit of partyUnits()) {
        probe(`C_UnitAuras ${unit} buff 1 name,spellId,sourceUnit`, ctx, 3, () => {
            const aura = C_UnitAuras.GetAuraDataByIndex(unit, 1, "HELPFUL");
            return [aura?.name, aura?.spellId, aura?.sourceUnit];
        });
    }
    const suggestions = partyBuffSuggestions();
    const summary = suggestions.map((s) => `${spellName(s.spellId) ?? tostring(s.spellId)} x${s.names.length}`);
    count("party buffs suggested", ctx, summary.length > 0 ? summary.join(", ") : "none");
}

function sampleReagents(ctx: string): void {
    const low = lowReagents().map((stock) => `${stock.name}=${stock.count}`);
    count("reagents running low", ctx, low.length > 0 ? low.join(", ") : "none");
}

/** Shapeshift forms page the main bar: is the form bar readable in combat? */
function sampleForms(ctx: string): void {
    const forms = attempt(GetNumShapeshiftForms);
    if (forms === undefined || !readable(forms) || forms < 1) return;
    for (let index = 1; index <= math.min(forms, 6); index++) {
        probe(`GetShapeshiftFormInfo(${index}) icon,active,castable,spellID`, ctx, 4, () => [...GetShapeshiftFormInfo(index)]);
    }
}

/** The real names of the buffs on the player, out of combat only (in combat they are hidden). */
function sampleNames(): void {
    if (inCombat()) return;
    for (let i = 1; i <= 20; i++) {
        const aura = attempt(C_UnitAuras.GetAuraDataByIndex, "player", i, "HELPFUL");
        if (!aura) return;
        countText("buff on you", aura.name);
    }
}

/** One sample of everything worth knowing; runs once a second in debug mode. */
export function sample(): void {
    store().samples += 1;
    const ctx = context();
    probe("C_UnitAuras buff 1 name,spellId,expirationTime", ctx, 3, () => {
        const aura = C_UnitAuras.GetAuraDataByIndex("player", 1, "HELPFUL");
        return [aura?.name, aura?.spellId, aura?.expirationTime];
    });
    probe("UnitAffectingCombat(player)", ctx, 1, () => [UnitAffectingCombat("player")]);
    sampleNames();
    sampleBuffs(ctx);
    if (weaponChoices().length > 0) sampleWeapon(ctx);
    sampleRanks(ctx);
    sampleForms(ctx);
    sampleParty(ctx);
    sampleReagents(ctx);
}

function onDebugEvent(event: WowEvent, ...payload: unknown[]): void {
    const ctx = context();
    if (event === "UNIT_SPELLCAST_SUCCEEDED") {
        count(`event ${event} spellID`, ctx, classify(payload[2]));
    } else if (event === "UI_ERROR_MESSAGE") {
        count(`event ${event} message`, ctx, classify(payload[1]));
        countText("UI_ERROR_MESSAGE", payload[1]);
    } else {
        count(`event ${event}`, ctx, "fired");
    }
}

function recordInfo(): void {
    const [version, build, , interfaceVersion] = GetBuildInfo();
    store().info = {
        client: `${version} (build ${build}, interface ${interfaceVersion})`,
        addon: tostring(attempt(C_AddOns.GetAddOnMetadata, addonName, "Version")),
        className: tostring(classToken()),
        level: tostring(UnitLevel("player")),
    };
}

/** Starts or stops collecting, following settings.debugMode. */
export function apply(): void {
    if (settings.debugMode) {
        // A full store drops every new key: start over, the old data is stale
        if (settings.debug && settings.debug.keys >= MAX_KEYS) clear();
        recordInfo();
        if (!eventFrame) {
            eventFrame = CreateFrame("Frame");
            eventFrame.SetScript("OnEvent", (_frame, event, ...payload) => onDebugEvent(event, ...payload));
        }
        eventFrame.RegisterUnitEvent("UNIT_SPELLCAST_SUCCEEDED", "player");
        eventFrame.RegisterEvent("WEAPON_ENCHANT_CHANGED");
        eventFrame.RegisterEvent("UI_ERROR_MESSAGE");
        ticker ??= C_Timer.NewTicker(SAMPLE_SECONDS, () => attempt(sample));
    } else {
        eventFrame?.UnregisterAllEvents();
        ticker?.Cancel();
        ticker = undefined;
    }
}

export function clear(): void {
    settings.debug = undefined;
}

/** The collected data as text, to copy into a bug report. */
export function report(): string {
    const d = store();
    const info = d.info;
    const lines = [
        "Forever Reminders debug report",
        `client: ${info?.client ?? "?"} | addon: ${info?.addon ?? "?"} | ${info?.className ?? "?"} level ${info?.level ?? "?"}`,
        `samples: ${d.samples}, keys: ${d.keys}, dropped: ${d.dropped}`,
    ];
    if (settings.blockedAction !== undefined) lines.push(`blocked action: ${settings.blockedAction}`);

    const probes: string[] = [];
    const byProbe = new LuaMap<string, string[]>();
    for (const [key, n] of pairs(d.counts)) {
        const [name, ctx, result] = string.match(key as string, "^(.-)\t(.-)\t(.*)$");
        if (name !== undefined) {
            let list = byProbe.get(name);
            if (!list) {
                list = [];
                byProbe.set(name, list);
                probes.push(name);
            }
            list.push(`  ${ctx} -> ${result}  x${n}`);
        }
    }
    probes.sort();
    for (const name of probes) {
        lines.push(name);
        lines.push(...(byProbe.get(name) ?? []).sort());
    }

    const texts: string[] = [];
    for (const [key, n] of pairs(d.texts)) texts.push(`${key}  x${n}`);
    texts.sort();
    if (texts.length > 0) {
        lines.push("texts the client sent");
        for (const text of texts) lines.push(`  ${text}`);
    }
    return lines.join("\n");
}
