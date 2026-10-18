// The shaman's totems through a fight. The client hides the totem slots in combat, so readable reads teach each totem's
// slot and duration, and in combat the player's own casts stand in (one totem per slot: a new one replaces the old).
// A totem the player walked away from (more than TOTEM_RANGE yards) counts as gone, so a new pull gets a new one; while
// its effect is still on the player (Stoneskin for Stoneskin Totem) it counts as up for the effect's time left.
import {
    hasKnownExpiry,
    type ClockService,
    type PlayerService,
    type SpellsService,
    type TotemsService,
    TOTEM_SLOTS,
    type WorldPosition,
    buildNameKey,
} from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";
import type { AuraReaderService } from "./aura-reader.service";

/** Yards: the debug data showed the effect still on the player at 20-24 yards; 30 is a guess. */
const TOTEM_RANGE = 30;

interface DroppedTotem {
    key: string;
    at: number;
    seconds: number;
    /** Where it was dropped; undefined when unknown (seen in its slot after a /reload). */
    spot: WorldPosition | undefined;
}

export class TotemTrackerService {
    private readonly slotByKey = new LuaMap<string, number>();
    private readonly secondsByKey = new LuaMap<string, number>();
    private readonly dropped = new LuaMap<number, DroppedTotem>();
    /** Effect name -> when the effect seen out of combat runs out. */
    private readonly effectUntil = new LuaMap<string, number>();

    constructor(
        private readonly totems: TotemsService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly clock: ClockService,
        private readonly nameKeys: NameKeysService,
        private readonly traits: SpellTraitsService,
        private readonly auraReader: AuraReaderService,
    ) {}

    /** The player dropped a totem: it stands where they are, in its slot. */
    noteTotemCast(spellId: number): void {
        const key = this.nameKeys.findKeyOf(spellId);
        if (key === undefined) return;
        const entry = this.traits.findTotem(spellId);
        const slot = this.slotByKey.get(key) ?? entry?.slot;
        if (slot === undefined) return;
        const seconds = this.secondsByKey.get(key) ?? entry?.seconds ?? 60;
        this.dropped.set(slot, { key, at: this.clock.getCurrentTime(), seconds, spot: this.player.getPosition() });
    }

    /** A slot changed (PLAYER_TOTEM_UPDATE): read it while readable. */
    noteTotemSlot(slot: number): void {
        const standing = this.totems.readTotemSlot(slot);
        if (standing === false) this.dropped.delete(slot);
        else if (standing !== undefined) this.syncSlot(slot, buildNameKey(standing.name), standing.startTime, standing.duration);
    }

    /** Totems vanish when the player dies. */
    clearTotems(): void {
        for (const [slot] of this.dropped) this.dropped.delete(slot);
    }

    /** Seconds left on the totem; 0 when it is not down or the player walked away (its effect counts then). */
    getTotemRemaining(spellId: number): number {
        const resolved = this.spells.resolveOrSame(spellId);
        const wantName = this.spells.getSpellName(resolved) ?? this.spells.getSpellName(spellId);
        if (wantName === undefined || wantName === "") return 0;
        const wantKey = buildNameKey(wantName);
        const entry = this.traits.findTotem(spellId);
        const wantedSlot = this.slotByKey.get(wantKey) ?? entry?.slot;
        for (let slot = 1; slot <= TOTEM_SLOTS; slot++) {
            const remain = this.judgeSlot(slot, wantKey, wantName, slot === wantedSlot, entry?.when === "pull");
            if (remain !== undefined) return remain;
        }
        return this.getEffectRemaining(wantName);
    }

    /** What a slot says of the wanted totem: its seconds left, or undefined when the slot does not tell. */
    private judgeSlot(slot: number, wantKey: string, wantName: string, isWantedSlot: boolean, isBuffTotem: boolean): number | undefined {
        this.noteTotemSlot(slot);
        const totem = this.dropped.get(slot);
        if (!totem) return undefined;
        const remain = totem.at + totem.seconds - this.clock.getCurrentTime();
        const isAlive = remain > 0 && !this.isWalkedAway(totem);
        if (this.isSameTotem(totem.key, wantKey)) return this.judgeOwnTotem(totem, remain, isAlive, wantName, isBuffTotem);
        // The slot holds another totem the player dropped (Earthbind in the earth slot): do not replace it while it lasts
        return isWantedSlot && isAlive ? remain : undefined;
    }

    /**
     * The wanted totem stands in its slot. Seen there with its drop point unknown (after a /reload), a buff totem whose
     * effect is not on the player out of combat is not helping.
     */
    private judgeOwnTotem(totem: DroppedTotem, remain: number, isAlive: boolean, wantName: string, isBuffTotem: boolean): number {
        const isUnhelpful =
            isAlive && totem.spot === undefined && isBuffTotem && this.clock.getCurrentTime() - totem.at > 5 && !this.player.isInCombat();
        if (isUnhelpful && this.getEffectRemaining(wantName) <= 0) return 0;
        return isAlive ? remain : this.getEffectRemaining(wantName);
    }

    private syncSlot(slot: number, key: string, startTime: number, duration: number): void {
        this.slotByKey.set(key, slot);
        if (duration > 0) this.secondsByKey.set(key, duration);
        const totem = this.dropped.get(slot);
        if (totem && totem.key === key && math.abs(totem.at - startTime) < 2) {
            totem.at = startTime;
            totem.seconds = duration;
            return;
        }
        // A totem seen right after it was dropped stands where the player is now
        const spot = this.clock.getCurrentTime() - startTime < 3 ? this.player.getPosition() : undefined;
        this.dropped.set(slot, { key, at: startTime, seconds: duration, spot });
    }

    /** "searing totem" is the same totem as "searing" (a name without the word "totem"). */
    private isSameTotem(key: string, wantKey: string): boolean {
        if (key === wantKey) return true;
        const wantFamily = this.getFamily(wantKey);
        return this.getFamily(key) === wantFamily || string.find(key, wantFamily, 1, true)[0] !== undefined;
    }

    private getFamily(key: string): string {
        const [withoutSuffix] = string.gsub(key, "%s+totem$", "");
        const [family] = string.gsub(withoutSuffix, "^totem%s+", "");
        return family;
    }

    private isWalkedAway(totem: DroppedTotem): boolean {
        if (!totem.spot) return false;
        const here = this.player.getPosition();
        if (!here) return false;
        if (here.mapId !== totem.spot.mapId) return true;
        const dx = here.x - totem.spot.x;
        const dy = here.y - totem.spot.y;
        return dx * dx + dy * dy > TOTEM_RANGE * TOTEM_RANGE;
    }

    /** Seconds left on the totem's effect on the player (remembered in combat, where the client hides auras). */
    private getEffectRemaining(totemName: string): number {
        const now = this.clock.getCurrentTime();
        const isInCombat = this.player.isInCombat();
        const [effectName] = string.gsub(totemName, "%s+[Tt]otem$", "");
        for (const name of [effectName, totemName]) {
            const [isFound, remain] = this.auraReader.findAuraByName(name);
            if (isFound) {
                if (hasKnownExpiry(remain)) this.effectUntil.set(name, now + remain);
                else this.effectUntil.delete(name);
                return remain;
            }
            if (isInCombat) {
                const left = (this.effectUntil.get(name) ?? 0) - now;
                if (left > 0) return left;
            } else {
                this.effectUntil.delete(name);
            }
        }
        return 0;
    }
}
