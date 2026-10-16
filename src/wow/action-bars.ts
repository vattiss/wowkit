// Which spell sits on which action button, and the spells that sit on the bars at an older rank
// than the one learned.
//
// Forever rules: never call C_TooltipInfo.GetAction while mapping the bars (tooltips froze the
// client when many slots updated after a quest turn-in), and map the bars a few buttons per frame.
// Only Blizzard's own bars are mapped (no Bartender4, Dominos or ElvUI).
import { getCurrentTime } from "./clock";
import { getHighestRank, resolve, getSpellInfo, getSpellRank } from "./spells";
import { attempt, attemptMulti, getReadableId, isReadable } from "./safe";
import { createSignal } from "../util/signal";
import { buildButtonKey } from "../util/text";

/** The bars were mapped again. */
export const barsMapped = createSignal();

const BARS = ["Action", "MultiBarBottomLeft", "MultiBarBottomRight", "MultiBarRight", "MultiBarLeft", "MultiBar5", "MultiBar6", "MultiBar7"];
/** Buttons mapped per frame. */
const MAP_BUDGET = 20;
/** Mapping is skipped when the last one is more recent than this (unless forced). */
const MAP_THROTTLE = 2;
/** An icon on more buttons than this is a generic one, not a particular spell's. */
const MAX_BUTTONS_PER_ICON = 4;

const buttonsBySpell = new LuaMap<number, ActionButton[]>();
const buttonsByName = new LuaMap<string, ActionButton[]>();
const buttonsByNameKey = new LuaMap<string, ActionButton[]>();
const buttonsByIcon = new LuaMap<number | string, ActionButton[]>();
let lastMapAt = 0;
let mapGeneration = 0;
/** When the player last changed the bars (a form, a stance, a page, a slot); the map is old until it is mapped again. */
let barsChangedAt = -10;

export function noteBarsChanged(): void {
    barsChangedAt = getCurrentTime();
}

export function getSecondsSinceBarsChanged(): number {
    return getCurrentTime() - barsChangedAt;
}

function getGlobal<T>(name: string): T | undefined {
    return (_G as unknown as { [name: string]: T | undefined })[name];
}

function push<K extends AnyNotNil>(map: LuaMap<K, ActionButton[]>, key: K, button: ActionButton): void {
    const list = map.get(key);
    if (list) list.push(button);
    else map.set(key, [button]);
}

function clear<K extends AnyNotNil, V>(map: LuaMap<K, V>): void {
    for (const [key] of map) map.delete(key);
}

/** A value equal to `expected`; secret values never are (comparing them would raise an error). */
function isToken(value: unknown, expected: string): boolean {
    return isReadable(value) && value === expected;
}

function getReadableSpellName(spellId: number | undefined): string | undefined {
    const id = getReadableId(spellId);
    if (id === undefined) return undefined;
    const name = getSpellInfo(id)?.name;
    return name !== undefined && isReadable(name) && name !== "" ? name : undefined;
}

/** A texture key: a readable file ID or a lowercase path. */
function getTextureKey(value: unknown): number | string | undefined {
    if (!isReadable(value) || value === 0 || value === "") return undefined;
    if (type(value) === "number" && (value as number) > 0) return value as number;
    if (type(value) === "string") return string.lower(value as string);
    return undefined;
}

// ---------------------------------------------------------------------------------------------
// Mapping

function addSpellName(name: string, button: ActionButton): void {
    push(buttonsByName, name, button);
    const key = buildButtonKey(name);
    if (key !== undefined) push(buttonsByNameKey, key, button);
}

function addSpell(spellId: unknown, button: ActionButton): void {
    const id = getReadableId(spellId);
    if (id === undefined) return;
    push(buttonsBySpell, id, button);
    const name = getReadableSpellName(id);
    if (name !== undefined) addSpellName(name, button);
}

/**
 * The slot the button shows now. A Blizzard action button keeps the paged slot in GetPagedID /
 * `action` (a druid form or warrior stance pages the main bar, e.g. bear form to 73-84), while
 * its "action" attribute is the base slot 1-12, so the attribute comes last.
 */
function getActionSlot(button: ActionButton): number | undefined {
    const getValidSlot = (slot: unknown) => (slot !== undefined && slot !== 0 ? (slot as number) : undefined);
    return (
        getValidSlot(button.GetPagedID ? attempt(() => button.GetPagedID!()) : undefined) ??
        getValidSlot(button.CalculateAction ? attempt(() => button.CalculateAction!()) : undefined) ??
        getValidSlot(button.action) ??
        getValidSlot(tonumber(attempt(() => button.GetAttribute("action"))))
    );
}

function hasAction(slot: number): boolean {
    return attempt(C_ActionBar.HasAction, slot) === true;
}

function addIcons(button: ActionButton, slot: number): void {
    const add = (value: unknown) => {
        const key = getTextureKey(value);
        if (key !== undefined) push(buttonsByIcon, key, button);
    };
    add(attempt(C_ActionBar.GetActionTexture, slot));
    const name = button.GetName();
    const icon = button.icon ?? button.Icon ?? (name !== undefined ? getGlobal<Texture>(`${name}Icon`) : undefined);
    if (icon) add(attempt(() => icon.GetTexture()));
}

/** Spells named on the cast lines of a macro (#showtooltip, /cast ...). */
function addMacroSpells(macro: number | string, button: ActionButton): void {
    const body = attempt(GetMacroBody, macro);
    if (body === undefined || !isReadable(body)) return;
    for (const [line] of string.gmatch(body, "[^\r\n]+")) {
        let [command] = string.match(line!, "^%s*#showtooltip%s+(.+)$");
        if (command === undefined) [command] = string.match(line!, "^%s*/%S+%s+(.+)$");
        if (command !== undefined) {
            // Drop [conditions], then read each "Spell, Other Spell; Third"
            const [cleaned] = string.gsub(command, "%b[]", " ");
            for (const [rawToken] of string.gmatch(cleaned, "[^,;]+")) addMacroToken(rawToken!, button);
        }
    }
}

function addMacroToken(rawToken: string, button: ActionButton): void {
    let [token] = string.gsub(strtrim(rawToken), "^!", "");
    [token] = string.gsub(token, "%s*%([^)]*%)%s*$", "");
    if (token === "") return;
    const info = attempt(C_Spell.GetSpellInfo, token);
    if (info === undefined || type(info) !== "table") return;
    addSpellName(isReadable(info.name) && info.name !== "" ? info.name : token, button);
    addSpell(info.spellID, button);
}

/** What the button casts: "spell" with a spell ID, "macro" with a macro, or nothing known. */
function getButtonAction(button: ActionButton, slot: number | undefined): LuaMultiReturn<[kind: string | undefined, id: unknown]> {
    const attrType = attempt(() => button.GetAttribute("type"));
    if (attrType === "spell" || attrType === "macro") return $multi(attrType, attempt(() => button.GetAttribute(attrType)));
    if (attrType !== undefined && attrType !== "action") return $multi(attrType, undefined);
    if (slot === undefined || !hasAction(slot)) return $multi(attrType, undefined);

    const [didSucceed, kind, actionId, , spellFromAction] = attemptMulti(() => GetActionInfo(slot));
    if (!didSucceed) return $multi(attrType, undefined);
    if (isToken(kind, "spell")) return $multi("spell", getReadableId(spellFromAction) ?? getReadableId(actionId));
    if (isToken(kind, "macro")) return $multi("macro", actionId);
    if (isToken(kind, "item")) {
        // A poison, a warlock stone: the spell the item casts is what the reminders name
        const itemId = getReadableId(actionId);
        const [didReadItemSpell, , itemSpell] = attemptMulti(() => C_Item.GetItemSpell(itemId));
        if (didReadItemSpell && getReadableId(itemSpell) !== undefined) return $multi("spell", getReadableId(itemSpell));
    }
    return $multi(attrType, undefined);
}

function addButton(button: ActionButton): void {
    const slot = getActionSlot(button);
    let [kind, id] = getButtonAction(button, slot);
    if (kind === "macro" && id !== undefined) {
        const macro = id as number | string;
        const macroSpell = getReadableId(attempt(GetMacroSpell, macro));
        if (macroSpell !== undefined) [kind, id] = ["spell", macroSpell];
        addMacroSpells(macro, button);
    }
    if (slot !== undefined && hasAction(slot)) addIcons(button, slot);
    if (kind === "spell" && id !== undefined) addSpell(getReadableId(getSpellInfo(getReadableId(id))?.spellID) ?? getReadableId(id), button);
}

type QueueEntry = { button: ActionButton } | { stance: number; button: ActionButton | undefined };

/** Maps every action button, a few per frame. `force` ignores the throttle. */
export function mapBars(isForced: boolean): void {
    if (!isForced && lastMapAt > 0 && getCurrentTime() - lastMapAt < MAP_THROTTLE) return;
    clear(buttonsBySpell);
    clear(buttonsByName);
    clear(buttonsByNameKey);
    clear(buttonsByIcon);
    lastMapAt = getCurrentTime();

    const queue: QueueEntry[] = [];
    const add = (name: string) => {
        const button = getGlobal<ActionButton>(name);
        if (button) queue.push({ button });
    };
    for (const bar of BARS) for (let i = 1; i <= 12; i++) add(`${bar}Button${i}`);
    // The shaman's totem bar: its buttons are action buttons too
    for (let i = 1; i <= 12; i++) add(`MultiCastActionButton${i}`);
    const forms = attempt(GetNumShapeshiftForms) ?? 0;
    for (let i = 1; i <= forms; i++) queue.push({ stance: i, button: getGlobal<ActionButton>(`StanceButton${i}`) });

    mapGeneration += 1;
    const generation = mapGeneration;
    let next = 0;
    const mapNextButtons = () => {
        if (generation !== mapGeneration) return;
        for (let budget = MAP_BUDGET; next < queue.length && budget > 0; budget--) {
            const entry = queue[next++]!;
            if (!("stance" in entry)) {
                addButton(entry.button);
            } else if (entry.button) {
                const [didSucceed, , , , spellId] = attemptMulti(() => GetShapeshiftFormInfo(entry.stance));
                if (didSucceed) addSpell(spellId, entry.button);
            }
        }
        if (next < queue.length) C_Timer.After(0, mapNextButtons);
        else barsMapped.emit();
    };
    mapNextButtons();
}

// ---------------------------------------------------------------------------------------------
// Queries

function addIconKeys(spellId: number | undefined, keys: LuaSet<number | string>): void {
    if (spellId === undefined) return;
    const add = (value: unknown) => {
        const key = getTextureKey(value);
        if (key !== undefined) keys.add(key);
    };
    add(attempt(() => C_Spell.GetSpellTexture(spellId)));
    const info = getSpellInfo(spellId);
    if (info) {
        add(info.iconID);
        add(info.originalIconID);
    }
}

/** The buttons a spell sits on: by ID, resolved ID, name, and (rarely shared) icon. */
export function findButtonsOf(spellId: number | undefined): ActionButton[] {
    const out: ActionButton[] = [];
    const seen = new LuaSet<ActionButton>();
    const take = (list: ActionButton[] | undefined) => {
        for (const button of list ?? []) {
            if (!seen.has(button)) {
                seen.add(button);
                out.push(button);
            }
        }
    };
    const id = getReadableId(spellId);
    const resolved = getReadableId(resolve(spellId));
    if (id !== undefined) take(buttonsBySpell.get(id));
    if (resolved !== undefined && resolved !== id) take(buttonsBySpell.get(resolved));
    const name = getReadableSpellName(id) ?? getReadableSpellName(resolved);
    if (name !== undefined) {
        take(buttonsByName.get(name));
        const key = buildButtonKey(name);
        if (key !== undefined) take(buttonsByNameKey.get(key));
    }
    const icons = new LuaSet<number | string>();
    addIconKeys(id, icons);
    addIconKeys(resolved ?? id, icons);
    for (const key of icons) {
        const list = buttonsByIcon.get(key);
        if (list && list.length > 0 && list.length <= MAX_BUTTONS_PER_ICON) take(list);
    }
    return out;
}

export function isOnBars(spellId: number | undefined): boolean {
    return findButtonsOf(spellId).length > 0;
}

/** Names of the buttons a spell sits on (for the debug report). */
export function getButtonNamesOf(spellId: number | undefined): string[] {
    return findButtonsOf(spellId).map((button) => button.GetName() ?? "unnamed");
}

export interface OldRank {
    id: number;
    name: string;
    onBar: number;
    best: number;
}

/** Every spell on the bars at a lower rank than the highest learned one, sorted by name. */
export function findOutdatedRanks(): OldRank[] {
    const byName = new LuaMap<string, { id: number; rank: number }>();
    for (const [id] of buttonsBySpell) {
        const name = getReadableSpellName(id);
        const rank = name !== undefined ? getSpellRank(id) : undefined;
        if (name !== undefined && rank !== undefined && rank > (byName.get(name)?.rank ?? -1)) byName.set(name, { id, rank });
    }
    const out: OldRank[] = [];
    for (const [name, entry] of byName) {
        const best = getHighestRank(entry.id);
        if (best !== undefined && best > entry.rank) out.push({ id: entry.id, name, onBar: entry.rank, best });
    }
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
}
