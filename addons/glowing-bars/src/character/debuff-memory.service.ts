// The player's debuffs on the enemies, foreseen from the casts: in a fight the game keeps a target's debuffs from addon
// code, so a cast of an added debuff at the enemy targeted is taken to put it on that enemy for as long as it lasts. Each
// enemy is kept apart by its GUID, so one targeted again still has its debuff; one that dies loses them. How long a debuff
// lasts is learned from its aura whenever the game shows it (kept per character), else taken from a short list; with
// neither, a cast counts until the target changes. Where the game shows the aura, the aura is the truth.
import { OnEvent, OnGameEvent } from "@wowkit/core";
import {
    type ClockService,
    type PlayerService,
    type PlayerSpellCast,
    type SpellsService,
    type UnitsService,
    buildNameKey,
    hasKnownExpiry,
    isSameName,
} from "@wowkit/wow";
import type { AddedSpellsService } from "../glows/added-spells.service";
import { DEBUFF_SECONDS } from "../reminders/debuffs.constants";
import type { AddonSettingsService } from "../settings/settings.interface";

/** The end of a debuff whose length is not known: it counts until the target changes. */
const UNTIL_TARGET_CHANGES = math.huge;

/** Has the map no entry at all? */
function isEmptyMap<K extends AnyNotNil, V>(map: LuaMap<K, V>): boolean {
    for (const [_key] of map) return false;
    return true;
}

export class DebuffMemoryService {
    /** When the debuffs cast on each enemy run out: by the enemy's GUID, then by the debuff's name key. */
    private readonly ends = new LuaMap<string, LuaMap<string, number>>();
    /** Goes up with each new target: an enemy whose GUID the game hides is told apart by it. */
    private targetCount = 0;

    constructor(
        private readonly addedSpells: AddedSpellsService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly units: UnitsService,
        private readonly clock: ClockService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** A cast of an added debuff with an enemy targeted: its debuff is on that enemy from now, for as long as it lasts. */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        const spellId = cast.spellId;
        if (spellId === undefined || !this.player.hasEnemyTarget()) return;
        const name = this.spells.getSpellName(spellId) ?? cast.spellName;
        if (name === undefined || name === "") return;
        const isAdded = this.addedSpells
            .listAdded("missingDebuff")
            .some((id) => id === spellId || isSameName(this.spells.getSpellName(id), name));
        if (!isAdded) return;
        const key = buildNameKey(name);
        const seconds = this.findSeconds(key, name);
        this.changeEnd(key, seconds === undefined ? UNTIL_TARGET_CHANGES : this.clock.getCurrentTime() + seconds);
    }

    /** A new target: the debuffs of unknown length are no longer counted, and those run out are forgotten. */
    @OnGameEvent("PLAYER_TARGET_CHANGED")
    noteTargetChange(): void {
        this.targetCount += 1;
        const now = this.clock.getCurrentTime();
        for (const [guid, ends] of this.ends) {
            for (const [key, end] of ends) if (end === UNTIL_TARGET_CHANGES || end <= now) ends.delete(key);
            if (isEmptyMap(ends)) this.ends.delete(guid);
        }
    }

    /** When the debuff (by its name key) runs out on the target, as remembered; undefined when none is. */
    findEnd(key: string): number | undefined {
        return this.ends.get(this.findTargetKey())?.get(key);
    }

    /** The game shows the target's debuffs: this one has `remain` seconds left, or is not there (undefined). */
    updateEnd(key: string, remain: number | undefined): void {
        if (remain === undefined) {
            this.ends.get(this.findTargetKey())?.delete(key);
            return;
        }
        this.changeEnd(key, hasKnownExpiry(remain) ? this.clock.getCurrentTime() + remain : UNTIL_TARGET_CHANGES);
    }

    /** The target died: its debuffs went with it. */
    forgetTarget(): void {
        this.ends.delete(this.findTargetKey());
    }

    /** The length of the player's own aura of the debuff, as the game shows it: kept, so the casts in a fight follow it. */
    recordSeconds(key: string, duration: number): void {
        const seconds = math.floor(duration + 0.5);
        const durations = this.settings.get("debuffDurations");
        if (seconds <= 0 || durations[key] === seconds) return;
        this.settings.change("debuffDurations", { ...durations, [key]: seconds });
    }

    /** How long the debuff lasts: as learned from its aura, else as the list says; undefined when neither knows. */
    private findSeconds(key: string, name: string): number | undefined {
        const learned = this.settings.get("debuffDurations")[key];
        if (learned !== undefined) return learned;
        return DEBUFF_SECONDS.find(([listId]) => isSameName(this.spells.getSpellName(listId), name))?.[1];
    }

    private changeEnd(key: string, end: number): void {
        const targetKey = this.findTargetKey();
        let ends = this.ends.get(targetKey);
        if (ends === undefined) {
            ends = new LuaMap<string, number>();
            this.ends.set(targetKey, ends);
        }
        ends.set(key, end);
    }

    /** The target by its GUID; one the game hides it of counts as the same only until the target changes. */
    private findTargetKey(): string {
        return this.units.getGuid("target") ?? `hidden:${this.targetCount}`;
    }
}
