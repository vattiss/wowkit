// Blizzard's Cooldown Manager: in a fight the game hides the player's buffs from addons, but the icons of its windows still
// know whether the buff they track is up. It has to be running for that, it can be out of sight. One answer for all four
// windows: up, gone, or undefined when an icon has nothing to say and the addon must find out another way.
import { OnEvent } from "@wowkit/core";
import {
    findActiveLayout,
    readCategoryOverrides,
    readSavedLayouts,
    setCategoryOverride,
    useOwnLayout,
    writeSavedLayouts,
    type SavedLayout,
} from "./cooldown-layouts";
import type { SpellsService } from "./spells.service";
import { attempt } from "./utils/protected-call.utils";
import { getReadable } from "./utils/secret-value.utils";

const ENABLED_CVAR = "cooldownViewerEnabled";
/** An addon that runs the Cooldown Manager itself, turns it on and handles its windows and their icons. */
const OTHER_MANAGER_ADDON = "EllesmereUICooldownManager";
const BUFF_VIEWERS = ["BuffIconCooldownViewer", "BuffBarCooldownViewer"];
const ALL_VIEWERS = ["EssentialCooldownViewer", "UtilityCooldownViewer", ...BUFF_VIEWERS];
/** The windows, by the key the settings know them by. A glow on Tracked Bars goes on the icon of a bar, not the wide strip. */
const ICON_VIEWERS = {
    essential: "EssentialCooldownViewer",
    utility: "UtilityCooldownViewer",
    trackedBuffs: "BuffIconCooldownViewer",
    trackedBars: "BuffBarCooldownViewer",
};
export type CooldownWindow = keyof typeof ICON_VIEWERS;
export const COOLDOWN_WINDOWS: CooldownWindow[] = ["trackedBuffs", "trackedBars", "essential", "utility"];
/** Enum.CooldownViewerCategory: Tracked Buffs, and the groups of the Buffs and the Spells tab that the addon can use. */
const TRACKED_BUFF_CATEGORY = 2;
const BUFF_CATEGORIES = [TRACKED_BUFF_CATEGORY, 3, 6];
const SPELL_CATEGORIES = [0, 1, 5];
/** Enum.CooldownSetSpellFlags.HideByDefault: a bit of the flags. */
const HIDE_BY_DEFAULT = 2;
/** Any group below zero is Not Displayed. */
const NOT_DISPLAYED = -1;

/** What Blizzard's list says of an entry. */
interface ViewerEntry {
    /** Its spell and the spells linked to it: the ranks, a Greater Blessing, the buff of a talent. */
    names: string[];
    /** The spell IDs an icon of it takes an aura by, exactly: Blizzard compares no ranks. */
    ids: number[];
    /** A spell whose icon shows a buff on the player. */
    isOwnBuff: boolean;
}

/** One entry of Blizzard's list, for a tool that reports on it. */
export interface ViewerCatalogEntry {
    category: number;
    cooldownId: number;
    spellId: number | undefined;
    /** The name of its spell first, then those of the spells linked to it. */
    names: string[];
    isOwnBuff: boolean;
    hasAura: boolean;
    isHiddenByDefault: boolean;
    isKnown: boolean;
}

/** Enum.CooldownViewerCategory, every group of Blizzard's list. */
const LAST_CATEGORY = 8;

export class CooldownViewerService {
    private readonly entries = new LuaMap<number, ViewerEntry>();
    private iconStates = new LuaMap<string, boolean>();
    /** The same, by each spell ID the icons take an aura by. */
    private iconStatesById = new LuaMap<number, boolean>();
    private cooldownStates = new LuaMap<string, boolean>();
    /** The totems of the buff icons, by name: true while an icon holds the player's own totem. */
    private totemStates = new LuaMap<string, boolean>();
    private iconStatesAt = -1;
    /** Is the addon allowed to go by the icons? */
    private isUsingIcons = true;

    constructor(private readonly spells: SpellsService) {}

    @OnEvent("spells.invalidated")
    forgetEntries(): void {
        for (const [id] of this.entries) this.entries.delete(id);
    }

    /** Does another addon run the windows? Then they are left to it. */
    isRunByOtherAddon(): boolean {
        const [isLoaded] = C_AddOns.IsAddOnLoaded(OTHER_MANAGER_ADDON);
        return isLoaded === true;
    }

    /** Is Blizzard's Cooldown Manager settings window in this client? */
    hasSettingsWindow(): boolean {
        return (_G as unknown as { CooldownViewerSettings?: Frame }).CooldownViewerSettings !== undefined;
    }

    /** Opens Blizzard's Cooldown Manager settings window. Only shows it, as EllesmereUI does: anything more from addon code (picking a tab) taints it. */
    openSettingsWindow(): void {
        (_G as unknown as { CooldownViewerSettings?: Frame }).CooldownViewerSettings?.Show();
    }

    isTurnedOn(): boolean {
        return attempt(C_CVar.GetCVarBool, ENABLED_CVAR) === true;
    }

    enable(): void {
        attempt(C_CVar.SetCVar, ENABLED_CVAR, "1");
    }

    disable(): void {
        attempt(C_CVar.SetCVar, ENABLED_CVAR, "0");
    }

    /** Off: every icon has no say, and the addon finds out another way. */
    useIcons(isOn: boolean): void {
        this.isUsingIcons = isOn;
    }

    /**
     * Keeps these running windows out of sight. Not Hide(): a hidden window stops following its buffs. Their icons stop reacting
     * to the mouse too, or invisible tooltips would come up where they stand.
     */
    hideIcons(windows: CooldownWindow[]): void {
        this.setIconsVisible(windows, false);
    }

    showIcons(windows: CooldownWindow[]): void {
        this.setIconsVisible(windows, true);
    }

    /**
     * Is the buff up, by the icons that track it? Undefined when none has a say. Read once a frame, for every buff together.
     * `auraSpellId`: the ID of the player's aura, when known. An icon takes an aura only by its entry's exact IDs, so one of
     * another rank (an older Mark of the Wild still on a bar) leaves it out: it has no say over that aura.
     */
    isBuffActive(spellName: string, auraSpellId?: number): boolean | undefined {
        if (!this.isUsingIcons) return undefined;
        this.refreshIconStates();
        return auraSpellId !== undefined ? this.iconStatesById.get(auraSpellId) : this.iconStates.get(spellName);
    }

    /** The icons in these windows that show this spell or buff. Read only: they are Blizzard's frames. */
    findIconsOf(spellName: string, windows: CooldownWindow[]): ActionButton[] {
        const icons: ActionButton[] = [];
        for (const window of windows) {
            for (const item of this.listIcons([window])) {
                const cooldownId = getReadable((item as unknown as CooldownViewerItem).cooldownID);
                if (cooldownId === undefined || this.findEntry(cooldownId)?.names.includes(spellName) !== true) continue;
                // A bar's own icon, the square at its end; hidden with the bar showing only a name, and the glow with it
                const barIcon = window === "trackedBars" ? (item as unknown as { Icon?: ActionButton }).Icon : undefined;
                icons.push(barIcon ?? item);
            }
        }
        return icons;
    }

    /** Is an icon of this spell or buff drawn now? One of a buff that is down is not, with Hide When Inactive on. */
    hasDrawnIcon(spellName: string, windows: CooldownWindow[]): boolean {
        return this.findIconsOf(spellName, windows).some((icon) => getReadable(attempt(() => icon.IsVisible())) === true);
    }

    listIcons(windows: CooldownWindow[]): ActionButton[] {
        const icons: ActionButton[] = [];
        for (const window of windows) {
            const viewer = this.getViewer(ICON_VIEWERS[window]);
            if (viewer !== undefined && this.isRunning(viewer)) icons.push(...(this.listItems(viewer) as unknown as ActionButton[]));
        }
        return icons;
    }

    /** Changes when an icon gets another spell: the window reuses its icons. */
    getIconsKey(windows: CooldownWindow[]): string {
        return this.listIcons(windows)
            .map((icon) => tostring(getReadable((icon as unknown as CooldownViewerItem).cooldownID)))
            .join(",");
    }

    /**
     * Does the player's totem of this name stand, by the buff icons? Undefined when none tracks it. An icon holds the totem
     * itself, so the aura of another shaman's totem of the same name does not count.
     */
    isTotemStanding(totemName: string): boolean | undefined {
        if (!this.isUsingIcons) return undefined;
        this.refreshIconStates();
        return this.totemStates.get(totemName);
    }

    /** Is the spell on its own cooldown (the global cooldown ignored), by its icon on the Spells tab? Undefined with no such icon. */
    isSpellOnCooldown(spellName: string): boolean | undefined {
        if (!this.isUsingIcons) return undefined;
        this.refreshIconStates();
        return this.cooldownStates.get(spellName);
    }

    private refreshIconStates(): void {
        const now = GetTime();
        if (now === this.iconStatesAt) return;
        this.iconStatesAt = now;
        this.readIconStates();
    }

    private readIconStates(): void {
        this.iconStates = new LuaMap<string, boolean>();
        this.iconStatesById = new LuaMap<number, boolean>();
        this.cooldownStates = new LuaMap<string, boolean>();
        this.totemStates = new LuaMap<string, boolean>();
        for (const name of ALL_VIEWERS) {
            const viewer = this.getViewer(name);
            if (viewer === undefined || !this.isRunning(viewer)) continue;
            const isBuffViewer = BUFF_VIEWERS.includes(name);
            for (const item of this.listItems(viewer)) this.noteIconState(item, isBuffViewer);
        }
    }

    /**
     * A window that is not on the screen (Hidden in Edit Mode, the manager switched off, the interface hidden) stops following
     * its buffs, and its icons keep what they last knew. One the addon keeps invisible still runs: that is only its alpha.
     */
    private isRunning(viewer: CooldownViewer): boolean {
        return getReadable(attempt(() => viewer.IsVisible())) !== false;
    }

    /** One icon that is up settles it; one that is out says so only until another says up. */
    private noteIconState(item: CooldownViewerItem, isBuffViewer: boolean): void {
        const cooldownId = getReadable(item.cooldownID);
        const entry = cooldownId !== undefined ? this.findEntry(cooldownId) : undefined;
        if (entry === undefined) return;
        if (!isBuffViewer) this.noteCooldownState(item, entry);
        const isUp = isBuffViewer ? this.readBuffIcon(item) : entry.isOwnBuff ? this.readSpellIcon(item) : undefined;
        if (isUp === undefined) return;
        noteState(this.iconStates, entry.names, isUp);
        noteState(this.iconStatesById, entry.ids, isUp);
        // Comparing with nil is allowed on a secret: the table is never looked into
        if (isBuffViewer) noteState(this.totemStates, entry.names, isUp && item.totemData !== undefined);
    }

    /** The cooldown is of the entry's own spell, not of the spells linked to it. */
    private noteCooldownState(item: CooldownViewerItem, entry: ViewerEntry): void {
        // The field, not IsOnCooldown(): that one tests it, and on a secret it fails in addon code
        const isOnCooldown = getReadable(item.isOnActualCooldown);
        const name = entry.names[0];
        if (isOnCooldown === undefined || name === undefined) return;
        if (isOnCooldown || !this.cooldownStates.has(name)) this.cooldownStates.set(name, isOnCooldown);
    }

    private readBuffIcon(item: CooldownViewerItem): boolean | undefined {
        const isActive = getReadable(attempt(() => item.IsActive()));
        return isActive === true ? this.isOnPlayer(item) : isActive;
    }

    /** An icon of the Spells tab is always active: it shows its buff by having an aura. Comparing with nil is allowed on a secret. */
    private readSpellIcon(item: CooldownViewerItem): boolean {
        const hasAura = item.auraInstanceID !== undefined || getReadable(item.wasSetFromAura) === true;
        return hasAura && this.isOnPlayer(item);
    }

    /** Blizzard also looks at the player's auras on a friendly target. When the game hides the unit, the icon is believed. */
    private isOnPlayer(item: CooldownViewerItem): boolean {
        const unit = getReadable(item.auraDataUnit);
        return unit === undefined || unit === "player";
    }

    private findEntry(cooldownId: number): ViewerEntry | undefined {
        const kept = this.entries.get(cooldownId);
        if (kept !== undefined) return kept;
        const info = attempt(C_CooldownViewer.GetCooldownViewerCooldownInfo, cooldownId);
        if (info === undefined) return undefined;
        const names: string[] = [];
        const ids = listEntrySpells(info);
        for (const id of ids) {
            const name = this.spells.getSpellName(getReadable(id));
            if (name !== undefined && name !== "" && !names.includes(name)) names.push(name);
        }
        if (names.length === 0) return undefined;
        const entry = { names, ids: listAuraIds(info, ids), isOwnBuff: getReadable(info.selfAura) === true };
        this.entries.set(cooldownId, entry);
        return entry;
    }

    /** Blizzard's layouts go by this: the character's class and spec. */
    getSpecTag(): number | undefined {
        const util = (_G as unknown as { CooldownViewerUtil?: CooldownViewerUtilFunctions }).CooldownViewerUtil;
        return attempt(() => util?.GetCurrentClassAndSpecTag());
    }

    /** Everything on Blizzard's list for this class and spec, learned or not. */
    listCatalog(): ViewerCatalogEntry[] {
        const catalog: ViewerCatalogEntry[] = [];
        for (let category = 0; category <= LAST_CATEGORY; category++) {
            for (const cooldownId of attempt(C_CooldownViewer.GetCooldownViewerCategorySet, category, true) ?? []) {
                const info = attempt(C_CooldownViewer.GetCooldownViewerCooldownInfo, cooldownId);
                const entry = this.findEntry(cooldownId);
                catalog.push({
                    category,
                    cooldownId,
                    spellId: info?.spellID,
                    names: entry?.names ?? [],
                    isOwnBuff: entry?.isOwnBuff === true,
                    hasAura: info?.hasAura === true,
                    isHiddenByDefault: (info?.flags ?? 0) % (2 * HIDE_BY_DEFAULT) >= HIDE_BY_DEFAULT,
                    isKnown: info?.isKnown === true,
                });
            }
        }
        return catalog;
    }

    /** The Group Buffs tab: the spell IDs of what Blizzard offers there, with whether each is hidden by default and known. */
    listGroupBuffs(): { spellId: number; name: string | undefined; isHiddenByDefault: boolean; isKnown: boolean }[] {
        return (attempt(C_CooldownViewer.GetGroupBuffItems) ?? []).map((item) => ({
            spellId: item.spellID,
            name: this.spells.getSpellName(item.spellID),
            isHiddenByDefault: item.flags % 2 === 1,
            isKnown: item.isKnown === true,
        }));
    }

    /**
     * Puts what has these names and is on Blizzard's list, learned or not, on display in the saved layout of the spec: a buff in
     * Tracked Buffs, a spell in its own group.
     * Asks the saved layout itself, so a buff is checked each time; their icons work from the next login or /reload.
     * False while the layouts are loading, or when they cannot be changed.
     */
    trackBuffs(spellNames: string[]): boolean {
        return attempt(() => this.writeTrackedBuffs(spellNames)) === true;
    }

    private writeTrackedBuffs(spellNames: string[]): boolean {
        const settings = (_G as unknown as { CooldownViewerSettings?: CooldownViewerSettingsFrame }).CooldownViewerSettings;
        if (settings === undefined || settings.GetDataProvider().GetLayoutManager() === false) return false;
        const util = (_G as unknown as { CooldownViewerUtil?: CooldownViewerUtilFunctions }).CooldownViewerUtil;
        const specTag = util?.GetCurrentClassAndSpecTag();
        const layouts = readSavedLayouts();
        if (specTag === undefined || layouts === undefined) return false;
        const active = findActiveLayout(layouts, specTag);
        const hidden = this.listHiddenBuffs(active, spellNames);
        if (hidden.length === 0) return true;
        const layout = active ?? useOwnLayout(layouts, specTag);
        for (const { id, group } of hidden) setCategoryOverride(layout, id, group);
        return writeSavedLayouts(layouts);
    }

    /** The entries of Blizzard's list with these names that the layout leaves under Not Displayed, and the group each goes to. */
    private listHiddenBuffs(layout: SavedLayout | undefined, spellNames: string[]): { id: number; group: number }[] {
        const overrides = readCategoryOverrides(layout);
        const hidden: { id: number; group: number }[] = [];
        for (const category of [...SPELL_CATEGORIES, ...BUFF_CATEGORIES]) {
            for (const id of C_CooldownViewer.GetCooldownViewerCategorySet(category, true)) {
                const info = C_CooldownViewer.GetCooldownViewerCooldownInfo(id);
                const names = this.findEntry(id)?.names ?? [];
                const isHiddenByDefault = (info?.flags ?? 0) % (2 * HIDE_BY_DEFAULT) >= HIDE_BY_DEFAULT;
                const current = overrides.get(id) ?? (isHiddenByDefault ? NOT_DISPLAYED : category);
                if (current >= 0 || !names.some((name) => spellNames.includes(name))) continue;
                hidden.push({ id, group: SPELL_CATEGORIES.includes(category) ? category : TRACKED_BUFF_CATEGORY });
            }
        }
        return hidden;
    }

    /** The bars of the tracked buffs go with their icons. */
    private setIconsVisible(windows: CooldownWindow[], isVisible: boolean): void {
        for (const window of windows) {
            for (const name of [ICON_VIEWERS[window]]) {
                const viewer = this.getViewer(name);
                if (viewer === undefined) continue;
                viewer.SetAlpha(isVisible ? 1 : 0);
                for (const item of this.listItems(viewer)) item.SetMouseMotionEnabled(isVisible);
            }
        }
    }

    private getViewer(name: string): CooldownViewer | undefined {
        return (_G as unknown as { [name: string]: CooldownViewer | undefined })[name];
    }

    private listItems(viewer: CooldownViewer): CooldownViewerItem[] {
        const items: CooldownViewerItem[] = [];
        if (viewer.itemFramePool === undefined) return items;
        for (const item of viewer.itemFramePool.EnumerateActive()) items.push(item);
        return items;
    }
}

/** One icon that is up settles it; one that is out says so only until another says up. */
function noteState<Key extends AnyNotNil>(states: LuaMap<Key, boolean>, keys: Key[], isUp: boolean): void {
    for (const key of keys) if (isUp || !states.has(key)) states.set(key, isUp);
}

/** An entry's spell, its override, then the spells linked to it. */
function listEntrySpells(info: CooldownViewerCooldown): number[] {
    // Pushed one by one, its own spell first: a nil in the middle of a Lua list would hide what comes after it
    const ids: number[] = [];
    if (info.spellID !== undefined) ids.push(info.spellID);
    if (info.overrideSpellID !== undefined) ids.push(info.overrideSpellID);
    ids.push(...(info.linkedSpellIDs ?? []));
    return ids;
}

/** What Blizzard takes an aura by, exactly: the entry's spells and its tooltip's spell, as far as the game shows them. */
function listAuraIds(info: CooldownViewerCooldown, spells: number[]): number[] {
    const auraIds: number[] = [];
    for (const id of [...spells, info.overrideTooltipSpellID]) {
        const readable = getReadable(id);
        if (readable !== undefined && !auraIds.includes(readable)) auraIds.push(readable);
    }
    return auraIds;
}
