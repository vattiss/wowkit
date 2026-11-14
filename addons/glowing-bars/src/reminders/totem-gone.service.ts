// The shaman's totems that are gone (issue #48): a totem the player dropped is killed or runs out, and the totem they dropped
// last in that element glows, so they can drop it again. Nothing glows before a totem of the element was dropped, and no
// totem is asked for: it tells what went, not what to drop. Whether a totem stands in a slot is read: the slot's own answer
// out of combat, else Blizzard's totem frame, which sees the slots the game hides in a fight. A slot that had the player's
// totem and has none now lost it, unless Totemic Recall took them back. Which totem it was, the player's casts tell.
import { OnEvent } from "@wowkit/core";
import type { ActionBarsService, ClockService, PlayerService, PlayerSpellCast, SpellsService, TotemsService } from "@wowkit/wow";
import { Shaman } from "@wowkit/wow-data";
import type { AddonSettingsService } from "../settings/settings.interface";
import { TOTEM_CALLS, TOTEM_ELEMENTS, TOTEM_SLOT_OF } from "./totems.constants";

/** A totem that comes into a slot this soon after the player's cast of it is that totem; Totemic Recall's losses as well. */
const CAST_SECONDS = 3;

/** What the addon knows of a slot. */
interface SlotState {
    /** A totem stands in it, at the last look that could tell. */
    isStanding: boolean;
    /** The player's totem in it is gone (killed, run out), until a totem stands in it again. */
    isGone: boolean;
    /** The player's last cast of a totem of this slot: when, and which. */
    castAt?: number;
    castSpell?: number;
}

export class TotemGoneService {
    private readonly slots = new LuaMap<number, SlotState>();
    private recallAt = -10;
    /** Totem name -> its slot, kept until the spells change. */
    private slotByName: LuaMap<string, number> | undefined;
    /** The slots Blizzard's totem frame shows at this look, read once and only when a slot's own answer is hidden. */
    private frameSlots: LuaSet<number> | undefined;
    private isFrameRead = false;

    constructor(
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly totems: TotemsService,
        private readonly settings: AddonSettingsService,
        private readonly clock: ClockService,
        private readonly player: PlayerService,
    ) {
        for (const element of TOTEM_ELEMENTS) this.slots.set(element.slot, { isStanding: false, isGone: false });
    }

    @OnEvent("spells.refreshed", "spells.invalidated", "spellbook.indexed")
    forgetSlots(): void {
        this.slotByName = undefined;
    }

    /** The table's row of a totem's element: its look and its switch go by it. */
    findElementRow(spellId: number): number {
        const slot = this.findSlot(spellId);
        return TOTEM_ELEMENTS.find((element) => element.slot === slot)?.rowId ?? spellId;
    }

    /** A cast of a totem, or of a call of the totem bar (a totem in each slot), or Totemic Recall. */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const now = this.clock.getCurrentTime();
        const name = this.spells.getSpellName(cast.spellId);
        if (name === this.spells.getSpellName(Shaman.TotemicRecall)) {
            this.recallAt = now;
            return;
        }
        const isCall = TOTEM_CALLS.some((id) => this.spells.getSpellName(id) === name);
        for (const spellId of isCall ? this.totems.listTotemBarSpells() : [cast.spellId]) {
            const state = this.slots.get(this.findSlot(spellId) ?? 0);
            if (state === undefined) continue;
            state.castAt = now;
            state.castSpell = spellId;
        }
    }

    /** The totems to drop again: the last of each element whose totem is gone, switched on and on a bar. */
    findGoneTotems(): number[] {
        // Only a shaman has totems: no other class asks the slots at all
        if (this.player.getClassToken() !== "SHAMAN" || !this.settings.get("isTotemGoneEnabled")) return [];
        const now = this.clock.getCurrentTime();
        this.isFrameRead = false;
        const gone: number[] = [];
        for (const element of TOTEM_ELEMENTS) {
            const state = this.slots.get(element.slot)!;
            this.updateSlot(element.slot, state, now);
            const last = this.settings.get("lastTotems")[string.format("%d", element.slot)];
            if (!state.isGone || last === undefined || this.settings.get("enabledSpells")[string.format("%d", element.rowId)] === false)
                continue;
            const spellId = this.spells.resolve(last) ?? last;
            if (this.actionBars.isOnBars(spellId)) gone.push(spellId);
        }
        return gone;
    }

    /** What the slot holds now, against what it held: a totem come, one gone, or one cast in place of another. */
    private updateSlot(slot: number, state: SlotState, now: number): void {
        const isStanding = this.readStanding(slot);
        if (isStanding === undefined) return;
        const isFreshCast = state.castAt !== undefined && now - state.castAt <= CAST_SECONDS;
        if (isStanding && (!state.isStanding || isFreshCast)) {
            state.isGone = false;
            if (isFreshCast && state.castSpell !== undefined) this.noteLast(slot, state.castSpell);
            state.castAt = undefined;
        }
        if (!isStanding && state.isStanding && now - this.recallAt > CAST_SECONDS) state.isGone = true;
        state.isStanding = isStanding;
    }

    /** Does a totem stand in the slot: its own answer, else Blizzard's totem frame; undefined when neither can tell. */
    private readStanding(slot: number): boolean | undefined {
        const read = this.totems.readTotemSlot(slot);
        if (read !== undefined) return read !== false;
        // Hidden (a fight): the frame, read once for all the slots of this look
        if (!this.isFrameRead) {
            this.frameSlots = this.totems.listFrameSlots();
            this.isFrameRead = true;
        }
        return this.frameSlots?.has(slot);
    }

    private noteLast(slot: number, spellId: number): void {
        const key = string.format("%d", slot);
        const lastTotems = this.settings.get("lastTotems");
        if (lastTotems[key] !== spellId) this.settings.change("lastTotems", { ...lastTotems, [key]: spellId });
    }

    /** The slot of a totem: as the game lists the player's totems for each slot, else by the list of the addon. */
    private findSlot(spellId: number): number | undefined {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined) return undefined;
        if (this.slotByName === undefined) {
            this.slotByName = new LuaMap();
            for (const element of TOTEM_ELEMENTS) {
                for (const id of this.totems.listSlotSpells(element.slot)) this.addSlotName(id, element.slot);
            }
            for (const [id, slot] of TOTEM_SLOT_OF) this.addSlotName(id, slot);
        }
        return this.slotByName.get(name);
    }

    private addSlotName(spellId: number, slot: number): void {
        const name = this.spells.getSpellName(spellId);
        if (name !== undefined && !this.slotByName!.has(name)) this.slotByName!.set(name, slot);
    }
}
