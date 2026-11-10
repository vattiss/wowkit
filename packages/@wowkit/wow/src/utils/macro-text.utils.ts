// What the text of a macro names, and which macro an action slot holds.
import { trimText } from "@wowkit/core";
import { attempt, attemptMulti } from "./protected-call.utils";
import { getReadable, getReadableId, isReadable } from "./secret-value.utils";

/** The commands that cast or use what they name, in the words of the game's own list of commands (SLASH_CAST1...). */
const CAST_COMMANDS = ["CAST", "USE", "CASTSEQUENCE", "CASTRANDOM", "USERANDOM"];
const USE_COMMANDS = ["USE", "USERANDOM"];
/** These name several things separated by commas; for /cast and /use a comma can be part of a name. */
const LIST_COMMANDS = ["CASTSEQUENCE", "CASTRANDOM", "USERANDOM"];
/** Macros are numbered past the account's, for those of the character: no number goes higher. */
const LAST_MACRO_NUMBER = 200;

/** What a line of a macro casts. */
interface CastLine {
    text: string;
    isList: boolean;
    isUse: boolean;
}

/** Is this slash command one of these, in the English every client understands or in the client's own language? */
function isCommandOf(command: string, names: string[]): boolean {
    const word = string.lower(command);
    const globals = _G as unknown as { [name: string]: string | undefined };
    return names.some((name) => {
        if (word === `/${string.lower(name)}`) return true;
        for (let index = 1; globals[`SLASH_${name}${index}`] !== undefined; index++) {
            if (string.lower(globals[`SLASH_${name}${index}`]!) === word) return true;
        }
        return false;
    });
}

/** Undefined for a line that casts nothing: /target, /say and the like. */
function readCastLine(line: string): CastLine | undefined {
    const [shown] = string.match(line, "^%s*#showtooltip%s+(.+)$");
    const [shownShort] = string.match(line, "^%s*#show%s+(.+)$");
    if (shown !== undefined || shownShort !== undefined) return { text: shown ?? shownShort!, isList: false, isUse: false };
    const [command, text] = string.match(line, "^%s*(/%S+)%s+(.+)$");
    if (command === undefined || text === undefined || !isCommandOf(command, CAST_COMMANDS)) return undefined;
    return { text, isList: isCommandOf(command, LIST_COMMANDS), isUse: isCommandOf(command, USE_COMMANDS) };
}

function listCastLines(body: string): CastLine[] {
    const lines: CastLine[] = [];
    for (const [line] of string.gmatch(body, "[^\r\n]+")) {
        const cast = readCastLine(line!);
        if (cast !== undefined) lines.push(cast);
    }
    return lines;
}

/** A name without its !, and without a (Rank 2): a rank has a number, the (Bear) of Mangle (Bear) is part of the name. */
function trimToken(raw: string): string {
    const [unforced] = string.gsub(strtrim(raw), "^!", "");
    const [unranked] = string.gsub(unforced, "%s*%([^)]*%d[^)]*%)%s*$", "");
    return unranked;
}

function listLineTokens(cast: CastLine): string[] {
    const tokens: string[] = [];
    const [cleaned] = string.gsub(cast.text, "%b[]", " ");
    for (const [clause] of string.gmatch(cleaned, "[^;]+")) {
        const [named] = string.gsub(strtrim(clause!), "^reset=%S+%s*", "");
        if (!cast.isList) tokens.push(trimToken(named));
        else for (const [part] of string.gmatch(named, "[^,]+")) tokens.push(trimToken(part!));
    }
    return tokens.filter((token) => token !== "");
}

/** The spells and items named on the cast lines of a macro (#showtooltip, /cast ...), without conditions and ranks. */
export function listMacroTokens(body: string): string[] {
    const tokens: string[] = [];
    for (const cast of listCastLines(body)) tokens.push(...listLineTokens(cast));
    return tokens;
}

/** Do several macros have this name? Then it does not tell which one is meant. */
function isMacroNameShared(name: string): boolean {
    let count = 0;
    for (let index = 1; index <= LAST_MACRO_NUMBER; index++) {
        const [didRead, other] = attemptMulti(() => GetMacroInfo(index));
        if (didRead && getReadable(other) === name) count += 1;
        if (count > 1) return true;
    }
    return false;
}

/**
 * The macro on an action slot, by its name; undefined when the name cannot tell: several macros have it. Many share a blank
 * one (players keep the text off the button that way), but a blank name only one macro has still finds it.
 */
export function findMacroOfSlot(slot: number): number | undefined {
    const name = getReadable(attempt(C_ActionBar.GetActionText, slot));
    if (name === undefined || name === "" || isMacroNameShared(name)) return undefined;
    const index = getReadable(attempt(GetMacroIndexByName, name));
    return index !== undefined && index > 0 ? index : undefined;
}

/** Does the slot hold a macro, one that shows a spell or an item too? */
export function isMacroSlot(slot: number | undefined): boolean {
    if (slot === undefined) return false;
    const [didRead, kind] = attemptMulti(() => GetActionInfo(slot));
    return didRead && getReadable(kind) === "macro";
}

/** The macro to read for what a slot gives: the game's number is that of the macro, except when the macro shows an item. */
export function findMacroOfAction(slot: number, subType: unknown, actionId: unknown): unknown {
    return isReadable(subType) && subType === "item" ? findMacroOfSlot(slot) : actionId;
}

/**
 * The macro on a slot that shows a spell now: the game only gives that spell, so its other lines are read by finding the
 * macro, by its name or, when the name cannot tell, as the one macro showing that spell now.
 */
export function findSpellMacroOfSlot(slot: number): number | undefined {
    const [didRead, kind, shownSpell, subType] = attemptMulti(() => GetActionInfo(slot));
    if (!didRead || getReadable(kind) !== "macro" || getReadable(subType) !== "spell") return undefined;
    return findMacroOfSlot(slot) ?? findMacroShowing(getReadableId(shownSpell));
}

/** The one macro that shows this spell now; undefined when none does, or several do and it cannot be told which. */
function findMacroShowing(spellId: number | undefined): number | undefined {
    if (spellId === undefined) return undefined;
    let found: number | undefined;
    for (let index = 1; index <= LAST_MACRO_NUMBER; index++) {
        if (getReadableId(attempt(GetMacroSpell, index)) !== spellId) continue;
        if (found !== undefined) return undefined;
        found = index;
    }
    return found;
}

/** The form button names are matched in: lowercase, a trailing "(...)" removed, trimmed; undefined when nothing is left. */
export function buildButtonKey(name: string): string | undefined {
    const [stripped] = string.gsub(name, "%s*%([^)]*%)%s*$", "");
    const key = trimText(string.lower(stripped));
    return key !== "" ? key : undefined;
}

/** What a macro names, as far as the game can tell. */
export interface MacroSpells {
    /** Of the spells: the names they go by. */
    names: string[];
    /** Of the spells and of what the items cast. */
    spellIds: unknown[];
    /** Does it use something the game could not name: an item the player may not have yet? */
    hasUnknownUse: boolean;
    /** The weapon it puts something on (/use 16 or /use 17). */
    handSlot?: number;
    /** Could its text be read? Then what it casts is known. */
    isRead: boolean;
}

/** A number is an inventory slot (/use 17), two are a bag and its slot (/use 0 1): neither is a spell. */
function isSlotToken(token: string): boolean {
    return tonumber(token) !== undefined || string.match(token, "^%d+%s+%d+$")[0] !== undefined;
}

/** The spells of the cast lines of a macro (#showtooltip, /cast ...), and the items of its /use lines. */
export function readMacroSpells(macro: number | string): MacroSpells {
    const found: MacroSpells = { names: [], spellIds: [], hasUnknownUse: false, isRead: false };
    const body = attempt(GetMacroBody, macro);
    if (body === undefined || !isReadable(body)) return found;
    found.isRead = true;
    const lines = listCastLines(body);
    const isUsing = lines.some((cast) => cast.isUse);
    found.handSlot = findHandSlot(lines);
    for (const token of listMacroTokens(body)) if (!isSlotToken(token)) readToken(token, isUsing, found);
    return found;
}

/** A /use line that names only weapon 16 or 17, whatever its conditions. */
function findHandSlot(lines: CastLine[]): number | undefined {
    for (const cast of lines) {
        if (!cast.isUse) continue;
        const [cleaned] = string.gsub(cast.text, "%b[]", " ");
        const slot = tonumber(strtrim(cleaned));
        if (slot === 16 || slot === 17) return slot;
    }
    return undefined;
}

function readToken(token: string, isUsing: boolean, found: MacroSpells): void {
    const info = attempt(C_Spell.GetSpellInfo, token);
    if (info !== undefined && type(info) === "table") {
        found.names.push(isReadable(info.name) && info.name !== "" ? info.name : token);
        found.spellIds.push(info.spellID);
        return;
    }
    // A poison or a stone: the game names the spell it casts only of what is in the bags
    const [didRead, , spellId] = attemptMulti(() => C_Item.GetItemSpell(token));
    const id = didRead ? getReadableId(spellId) : undefined;
    if (id !== undefined) found.spellIds.push(id);
    else if (isUsing) found.hasUnknownUse = true;
}
