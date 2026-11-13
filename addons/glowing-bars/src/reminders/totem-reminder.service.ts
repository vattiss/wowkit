// The shaman's totems: a totem glows while no totem stands in its slot (its element: fire, earth, water or air), and every
// totem of the slot goes quiet once one is dropped. Out of combat the slots are read; in a fight the client hides them, so
// the Cooldown Manager's icons of the totems tell, where every totem of the slot has one; else a change of a slot
// (PLAYER_TOTEM_UPDATE) right after the player's own cast of a totem, or of a call of four, is one dropped, and any other
// change one gone (killed, run out, recalled). A totem switched off in the table, or on no bar,
// does not glow. The totems are the ones the game lists for each slot, and those of the list below that it does not.
import { OnEvent, OnGameEvent } from "@wowkit/core";
import {
    getReadable,
    type ActionBarsService,
    type ClockService,
    type CooldownViewerService,
    type PlayerSpellCast,
    type SpellsService,
    type TotemsService,
} from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import { TOTEM_CALLS, TOTEM_SLOT_OF, TOTEM_SLOTS } from "./totems.constants";

/** A totem the player knows: the ID of its row (the list's, when it has one) and its slot. */
export interface KnownTotem {
    listId: number;
    slot: number;
}

/** A slot that changes this soon after the player's cast of a totem had one dropped in it. */
const CAST_SETTLE = 1;

/** No totem to remind of: one empty list for every tick (nobody changes it). */
const NO_TOTEMS: number[] = [];

export class TotemReminderService {
    /** The totems the player knows, kept until the spells change: every tick asks for them. */
    private known: KnownTotem[] | undefined;
    /** What each slot was last known to hold, for when the client hides them: true, a totem. */
    private readonly isSlotTaken = new LuaMap<number, boolean>();
    private lastTotemCastAt = -10;

    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly totems: TotemsService,
        private readonly settings: AddonSettingsService,
        private readonly clock: ClockService,
        private readonly viewer: CooldownViewerService,
    ) {}

    /** The totems the player knows, in slot order. */
    listTotems(): KnownTotem[] {
        this.known ??= this.readKnownTotems();
        return this.known;
    }

    @OnEvent("spells.refreshed", "spells.invalidated", "spellbook.indexed")
    forgetTotems(): void {
        this.known = undefined;
    }

    /** A totem or a call of four was cast: the slots that change now had totems dropped in them. */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const name = this.spells.getSpellName(cast.spellId);
        const isTotemCast =
            TOTEM_CALLS.some((id) => id === cast.spellId || this.spells.getSpellName(id) === name) ||
            this.listTotems().some((totem) => this.spells.getSpellName(totem.listId) === name);
        if (isTotemCast) this.lastTotemCastAt = this.clock.getCurrentTime();
    }

    @OnGameEvent("PLAYER_TOTEM_UPDATE")
    noteTotemChange(slot: number): void {
        const readable = getReadable(slot);
        if (readable === undefined) return;
        // In a fight a change right after the player's cast of a totem is one dropped; any other one, a totem gone
        if (this.readSlot(readable) === undefined)
            this.isSlotTaken.set(readable, this.clock.getCurrentTime() - this.lastTotemCastAt <= CAST_SETTLE);
    }

    /** The totems to drop: each one on a bar and switched on, of a slot that no totem stands in. */
    findMissingTotems(): number[] {
        if (!this.settings.get("isMissingTotemEnabled") || this.listTotems().length === 0) return NO_TOTEMS;
        const enabledSpells = this.settings.get("enabledSpells");
        const missing: number[] = [];
        for (const slot of TOTEM_SLOTS) {
            if (this.readSlot(slot) ?? this.readSlotIcons(slot) ?? this.isSlotTaken.get(slot) === true) continue;
            for (const totem of this.listTotems()) {
                if (totem.slot !== slot || enabledSpells[string.format("%d", totem.listId)] === false) continue;
                const id = this.spells.resolve(totem.listId) ?? totem.listId;
                if (this.actionBars.isOnBars(id)) missing.push(id);
            }
        }
        return missing;
    }

    /** Does a totem stand in the slot? Undefined while the client hides it; what it says is kept for then. */
    private readSlot(slot: number): boolean | undefined {
        const standing = this.totems.readTotemSlot(slot);
        if (standing === undefined) return undefined;
        this.isSlotTaken.set(slot, standing !== false);
        return standing !== false;
    }

    /**
     * Does a totem stand in the slot, by the Cooldown Manager's icons of its totems? Undefined unless they can tell: a totem
     * of the slot that no icon tracks may stand. What they say is kept for then.
     */
    private readSlotIcons(slot: number): boolean | undefined {
        let isEveryTracked = true;
        for (const totem of this.listTotems()) {
            if (totem.slot !== slot) continue;
            const name = this.spells.getSpellName(totem.listId);
            const isStanding = name !== undefined ? this.viewer.isTotemStanding(name) : undefined;
            if (isStanding === true) return this.noteSlot(slot, true);
            if (isStanding === undefined) isEveryTracked = false;
        }
        return isEveryTracked ? this.noteSlot(slot, false) : undefined;
    }

    private noteSlot(slot: number, isTaken: boolean): boolean {
        this.isSlotTaken.set(slot, isTaken);
        return isTaken;
    }

    /** The game's totems of each slot, by the list's ID when it has the totem (its row stays through new ranks), then the list's learned ones it left out. */
    private readKnownTotems(): KnownTotem[] {
        const found: KnownTotem[] = [];
        const names = new LuaSet<string>();
        const add = (listId: number, slot: number) => {
            const name = this.spells.getSpellName(listId) ?? string.format("%d", listId);
            if (names.has(name)) return;
            names.add(name);
            found.push({ listId, slot });
        };
        for (const slot of TOTEM_SLOTS) {
            for (const id of this.totems.listSlotSpells(slot)) {
                const name = this.spells.getSpellName(id);
                add(TOTEM_SLOT_OF.find(([listId]) => this.spells.getSpellName(listId) === name)?.[0] ?? id, slot);
            }
        }
        for (const [listId, slot] of TOTEM_SLOT_OF) if (this.spells.resolve(listId) !== undefined) add(listId, slot);
        return found.sort((a, b) => a.slot - b.slot);
    }
}
