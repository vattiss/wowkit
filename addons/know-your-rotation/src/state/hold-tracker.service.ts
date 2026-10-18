// Holds: after a DoT, a HoT or a snare is cast, the spell is not offered again for a while (SPELL_HOLDS), even when the
// client hides the aura. A hold of a harmful spell belongs to the target it was cast on: its GUID when readable,
// otherwise (an NPC's GUID is secret) the current target, and every target change clears it.
import type { ClockService, SpellsService, UnitsService } from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import { SPELL_HOLDS } from "../knowledge/spell-data.constants";
import type { SpellTraitsService } from "../knowledge/spell-traits.service";

interface Hold {
    endsAt: number;
    /** "self" for a hold on the player; a target's identity; false when there was no target. */
    owner: string | false;
}

export class HoldTrackerService {
    private readonly holds = new LuaMap<string, Hold>();
    /** Counts target changes: stands for a target whose GUID the client hides. */
    private targetSerial = 0;

    constructor(
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly clock: ClockService,
        private readonly traits: SpellTraitsService,
        private readonly nameKeys: NameKeysService,
    ) {}

    /** How long the spell is held after a cast; 0 for none. */
    getHoldSeconds(spellId: number): number {
        const resolved = this.spells.resolveOrSame(spellId);
        return math.max(0, SPELL_HOLDS[resolved] ?? SPELL_HOLDS[spellId] ?? 0);
    }

    /** The spell was cast: hold it for its hold time. */
    noteSpellCast(spellId: number): void {
        const seconds = this.getHoldSeconds(spellId);
        if (seconds <= 0) return;
        const owner = this.traits.isHarmful(spellId) ? (this.findTargetOwner() ?? false) : "self";
        const hold: Hold = { endsAt: this.clock.getCurrentTime() + seconds, owner };
        for (const key of this.listKeys(spellId)) this.holds.set(key, hold);
    }

    /** Seconds left on the spell's hold; 0 when none, or when it belonged to another (or a dead) target. */
    getHoldRemaining(spellId: number): number {
        const hold = this.findHold(spellId);
        if (!hold) return 0;
        if (hold.owner !== "self") {
            const current = this.findTargetOwner();
            if (hold.owner === false || current === undefined || current !== hold.owner || this.units.isDeadOrGhost("target")) {
                this.clearHold(spellId);
                return 0;
            }
        }
        const remain = hold.endsAt - this.clock.getCurrentTime();
        if (remain <= 0) {
            this.clearHold(spellId);
            return 0;
        }
        return remain;
    }

    clearHold(spellId: number): void {
        for (const key of this.listKeys(spellId)) this.holds.delete(key);
    }

    /** The target changed: the holds on the old one go. */
    noteTargetChanged(): void {
        this.targetSerial += 1;
        for (const [key, hold] of this.holds) {
            if (hold.owner !== "self") this.holds.delete(key);
        }
    }

    private findHold(spellId: number): Hold | undefined {
        for (const key of this.listKeys(spellId)) {
            const hold = this.holds.get(key);
            if (hold) return hold;
        }
        return undefined;
    }

    private findTargetOwner(): string | undefined {
        if (!this.units.doesExist("target")) return undefined;
        return this.units.getGuid("target") ?? `target#${this.targetSerial}`;
    }

    /** By name key and ID, of the spell and of the ID the player knows. */
    private listKeys(spellId: number): string[] {
        const keys: string[] = [];
        const resolved = this.spells.resolve(spellId);
        for (const id of resolved !== undefined && resolved !== spellId ? [spellId, resolved] : [spellId]) {
            keys.push(`id:${id}`);
            const nameKey = this.nameKeys.findKeyOf(id);
            if (nameKey !== undefined && !keys.includes(nameKey)) keys.push(nameKey);
        }
        return keys;
    }
}
