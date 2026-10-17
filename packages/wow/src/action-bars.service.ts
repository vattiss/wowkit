// Which spell sits on which action button, and the spells that sit on the bars at an older rank
// than the one learned.
//
// Forever rules: never call C_TooltipInfo.GetAction while mapping the bars (tooltips froze the
// client when many slots updated after a quest turn-in), and map the bars a few buttons per frame.
// Only Blizzard's own bars are mapped (no Bartender4, Dominos or ElvUI).
import type { EventBus } from "@forever/framework";
import { buildButtonKey } from "@forever/framework";
import type { ClockService } from "./clock.service";
import { getActionSlot, getButtonAction, getGlobal, getTextureKey, hasAction } from "./action-button";
import { attempt, attemptMulti, getReadableId, isReadable } from "./safe";
import type { SpellsService } from "./spells.service";

declare module "@forever/framework/event-bus" {
    interface AppEvents {
        /** The action bars were mapped again. */
        "bars.mapped": [];
    }
}

const BARS = [
    "Action",
    "MultiBarBottomLeft",
    "MultiBarBottomRight",
    "MultiBarRight",
    "MultiBarLeft",
    "MultiBar5",
    "MultiBar6",
    "MultiBar7",
];
/** Buttons mapped per frame. */
const MAP_BUDGET = 20;
/** Mapping is skipped when the last one is more recent than this (unless forced). */
const MAP_THROTTLE = 2;
/** An icon on more buttons than this is a generic one, not a particular spell's. */
const MAX_BUTTONS_PER_ICON = 4;

export interface OutdatedRank {
    id: number;
    name: string;
    onBar: number;
    best: number;
}

type QueueEntry = { button: ActionButton } | { stance: number; button: ActionButton | undefined };

function push<K extends AnyNotNil>(map: LuaMap<K, ActionButton[]>, key: K, button: ActionButton): void {
    const list = map.get(key);
    if (list) list.push(button);
    else map.set(key, [button]);
}

function clear<K extends AnyNotNil, V>(map: LuaMap<K, V>): void {
    for (const [key] of map) map.delete(key);
}

export class ActionBarsService {
    private readonly buttonsBySpell = new LuaMap<number, ActionButton[]>();
    private readonly buttonsByName = new LuaMap<string, ActionButton[]>();
    private readonly buttonsByNameKey = new LuaMap<string, ActionButton[]>();
    private readonly buttonsByIcon = new LuaMap<number | string, ActionButton[]>();
    private lastMapAt = 0;
    private mapGeneration = 0;
    /** When the player last changed the bars (a form, a stance, a page, a slot); the map is old until it is mapped again. */
    private barsChangedAt = -10;

    constructor(
        private readonly clock: ClockService,
        private readonly spells: SpellsService,
        private readonly bus: EventBus,
    ) {}

    noteBarsChanged(): void {
        this.barsChangedAt = this.clock.getCurrentTime();
    }

    getSecondsSinceBarsChanged(): number {
        return this.clock.getCurrentTime() - this.barsChangedAt;
    }

    /** Maps every action button, a few per frame. `isForced` ignores the throttle. */
    mapBars(isForced: boolean): void {
        if (!isForced && this.lastMapAt > 0 && this.clock.getCurrentTime() - this.lastMapAt < MAP_THROTTLE) return;
        clear(this.buttonsBySpell);
        clear(this.buttonsByName);
        clear(this.buttonsByNameKey);
        clear(this.buttonsByIcon);
        this.lastMapAt = this.clock.getCurrentTime();

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

        this.mapGeneration += 1;
        const generation = this.mapGeneration;
        let next = 0;
        const mapNextButtons = () => {
            if (generation !== this.mapGeneration) return;
            for (let budget = MAP_BUDGET; next < queue.length && budget > 0; budget--) {
                const entry = queue[next++]!;
                if (!("stance" in entry)) {
                    this.addButton(entry.button);
                } else if (entry.button) {
                    const [didSucceed, , , , spellId] = attemptMulti(() => GetShapeshiftFormInfo(entry.stance));
                    if (didSucceed) this.addSpell(spellId, entry.button);
                }
            }
            if (next < queue.length) C_Timer.After(0, mapNextButtons);
            else this.bus.emit("bars.mapped");
        };
        mapNextButtons();
    }

    /** The buttons a spell sits on: by ID, resolved ID, name, and (rarely shared) icon. */
    findButtonsOf(spellId: number | undefined): ActionButton[] {
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
        const resolved = getReadableId(this.spells.resolve(spellId));
        if (id !== undefined) take(this.buttonsBySpell.get(id));
        if (resolved !== undefined && resolved !== id) take(this.buttonsBySpell.get(resolved));
        const name = this.getReadableSpellName(id) ?? this.getReadableSpellName(resolved);
        if (name !== undefined) {
            take(this.buttonsByName.get(name));
            const key = buildButtonKey(name);
            if (key !== undefined) take(this.buttonsByNameKey.get(key));
        }
        const icons = new LuaSet<number | string>();
        this.addIconKeys(id, icons);
        this.addIconKeys(resolved ?? id, icons);
        for (const key of icons) {
            const list = this.buttonsByIcon.get(key);
            if (list && list.length > 0 && list.length <= MAX_BUTTONS_PER_ICON) take(list);
        }
        return out;
    }

    isOnBars(spellId: number | undefined): boolean {
        return this.findButtonsOf(spellId).length > 0;
    }

    /** Names of the buttons a spell sits on (for the debug report). */
    getButtonNamesOf(spellId: number | undefined): string[] {
        return this.findButtonsOf(spellId).map((button) => button.GetName() ?? "unnamed");
    }

    /** Every spell on the bars at a lower rank than the highest learned one, sorted by name. */
    findOutdatedRanks(): OutdatedRank[] {
        const byName = new LuaMap<string, { id: number; rank: number }>();
        for (const [id] of this.buttonsBySpell) {
            const name = this.getReadableSpellName(id);
            const rank = name !== undefined ? this.spells.getSpellRank(id) : undefined;
            if (name !== undefined && rank !== undefined && rank > (byName.get(name)?.rank ?? -1)) byName.set(name, { id, rank });
        }
        const out: OutdatedRank[] = [];
        for (const [name, entry] of byName) {
            const best = this.spells.getHighestRank(entry.id);
            if (best !== undefined && best > entry.rank) out.push({ id: entry.id, name, onBar: entry.rank, best });
        }
        out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return out;
    }

    private getReadableSpellName(spellId: number | undefined): string | undefined {
        const id = getReadableId(spellId);
        if (id === undefined) return undefined;
        const name = this.spells.getSpellInfo(id)?.name;
        return name !== undefined && isReadable(name) && name !== "" ? name : undefined;
    }

    private addSpellName(name: string, button: ActionButton): void {
        push(this.buttonsByName, name, button);
        const key = buildButtonKey(name);
        if (key !== undefined) push(this.buttonsByNameKey, key, button);
    }

    private addSpell(spellId: unknown, button: ActionButton): void {
        const id = getReadableId(spellId);
        if (id === undefined) return;
        push(this.buttonsBySpell, id, button);
        const name = this.getReadableSpellName(id);
        if (name !== undefined) this.addSpellName(name, button);
    }

    private addIcons(button: ActionButton, slot: number): void {
        const add = (value: unknown) => {
            const key = getTextureKey(value);
            if (key !== undefined) push(this.buttonsByIcon, key, button);
        };
        add(attempt(C_ActionBar.GetActionTexture, slot));
        const name = button.GetName();
        const icon = button.icon ?? button.Icon ?? (name !== undefined ? getGlobal<Texture>(`${name}Icon`) : undefined);
        if (icon) add(attempt(() => icon.GetTexture()));
    }

    /** Spells named on the cast lines of a macro (#showtooltip, /cast ...). */
    private addMacroSpells(macro: number | string, button: ActionButton): void {
        const body = attempt(GetMacroBody, macro);
        if (body === undefined || !isReadable(body)) return;
        for (const [line] of string.gmatch(body, "[^\r\n]+")) {
            let [command] = string.match(line!, "^%s*#showtooltip%s+(.+)$");
            if (command === undefined) [command] = string.match(line!, "^%s*/%S+%s+(.+)$");
            if (command !== undefined) {
                // Drop [conditions], then read each "Spell, Other Spell; Third"
                const [cleaned] = string.gsub(command, "%b[]", " ");
                for (const [rawToken] of string.gmatch(cleaned, "[^,;]+")) this.addMacroToken(rawToken!, button);
            }
        }
    }

    private addMacroToken(rawToken: string, button: ActionButton): void {
        let [token] = string.gsub(strtrim(rawToken), "^!", "");
        [token] = string.gsub(token, "%s*%([^)]*%)%s*$", "");
        if (token === "") return;
        const info = attempt(C_Spell.GetSpellInfo, token);
        if (info === undefined || type(info) !== "table") return;
        this.addSpellName(isReadable(info.name) && info.name !== "" ? info.name : token, button);
        this.addSpell(info.spellID, button);
    }

    private addButton(button: ActionButton): void {
        const slot = getActionSlot(button);
        let [kind, id] = getButtonAction(button, slot);
        if (kind === "macro" && id !== undefined) {
            const macro = id as number | string;
            const macroSpell = getReadableId(attempt(GetMacroSpell, macro));
            if (macroSpell !== undefined) [kind, id] = ["spell", macroSpell];
            this.addMacroSpells(macro, button);
        }
        if (slot !== undefined && hasAction(slot)) this.addIcons(button, slot);
        if (kind === "spell" && id !== undefined) {
            this.addSpell(getReadableId(this.spells.getSpellInfo(getReadableId(id))?.spellID) ?? getReadableId(id), button);
        }
    }

    private addIconKeys(spellId: number | undefined, keys: LuaSet<number | string>): void {
        if (spellId === undefined) return;
        const add = (value: unknown) => {
            const key = getTextureKey(value);
            if (key !== undefined) keys.add(key);
        };
        add(attempt(() => C_Spell.GetSpellTexture(spellId)));
        const info = this.spells.getSpellInfo(spellId);
        if (info) {
            add(info.iconID);
            add(info.originalIconID);
        }
    }
}
