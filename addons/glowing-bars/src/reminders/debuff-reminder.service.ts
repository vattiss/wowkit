// The debuffs of the Debuffs tab (beta), the class's own and those the player added by their ID (Serpent Sting, Hunter's
// Mark): with a living enemy targeted, in the spell's range and the spell castable, a debuff's button glows while the enemy
// lacks the player's own debuff of it, or it is about to run out (its row's Before). Its When says when that may show: with
// an enemy targeted by default. Where the game shows the target's debuffs, they are read; where it hides them
// (in a fight), the debuff is foreseen from the player's casts (DebuffMemoryService).
import { OnGameEvent } from "@wowkit/core";
import {
    type ActionBarsService,
    type AuraEntry,
    type AuraSecrecyService,
    type AurasService,
    type ClockService,
    type PlayerService,
    type SpellDetailsService,
    type SpellsService,
    buildNameKey,
    isSameName,
} from "@wowkit/wow";
import type { DebuffMemoryService } from "../character/debuff-memory.service";
import type { AddedSpellsService } from "../glows/added-spells.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { isAboutToExpire } from "./weapon/weapon-reactions";
import { buildDebuffSwitchKey, listDebuffs, type DebuffEntry } from "./debuffs.constants";

export class DebuffReminderService {
    private styles: StyleService | undefined;
    /** The debuffs to cast at this tick: the same list each time. */
    private readonly found: number[] = [];

    constructor(
        private readonly addedSpells: AddedSpellsService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly auras: AurasService,
        private readonly secrecy: AuraSecrecyService,
        private readonly player: PlayerService,
        private readonly clock: ClockService,
        private readonly settings: AddonSettingsService,
        private readonly memory: DebuffMemoryService,
        private readonly spellDetails: SpellDetailsService,
    ) {}

    /** The looks of the rows: how long before a debuff runs out it is asked for (its Before). */
    useLooks(styles: StyleService): void {
        this.styles = styles;
    }

    /** A new target: the debuffs read a moment ago were another enemy's. */
    @OnGameEvent("PLAYER_TARGET_CHANGED")
    wipeTargetScan(): void {
        this.auras.wipeAuraScan("target");
    }

    /**
     * The debuffs (the class's and the added ones), learned, switched on and on a button, that the living enemy targeted
     * lacks; none while the Debuffs tab's switch (beta) is off.
     */
    findMissingDebuffs(): number[] {
        const found = this.found;
        for (let index = found.length; index > 0; index--) found.pop();
        if (!this.settings.get("shouldUseDebuffs") || !this.settings.get("isMissingDebuffEnabled")) return found;
        const debuffs = listDebuffs(this.player.getClassToken(), this.addedSpells);
        if (debuffs.length === 0) return found;
        // A dead enemy's debuffs went with it
        if (this.player.hasTarget() && !this.player.hasLivingTarget()) this.memory.forgetTarget();
        if (!this.player.hasEnemyTarget()) return found;
        const shown = this.readShownDebuffs();
        for (const debuff of debuffs) {
            const learned = this.findShownDebuff(debuff);
            if (learned !== undefined && this.isMissing(learned, shown)) found.push(learned);
        }
        return found;
    }

    /**
     * The debuff's spell as learned, if it is switched on, on a button, and can be cast at the target now: in its range (the
     * game must say so: no answer is no) and usable (mana, no silence); else undefined.
     */
    private findShownDebuff(debuff: DebuffEntry): number | undefined {
        const learned = this.spells.resolve(debuff.spellId);
        if (learned === undefined || this.settings.get("enabledSpells")[buildDebuffSwitchKey(debuff.switchId)] === false) return undefined;
        if (!this.actionBars.isOnBars(learned) || this.spellDetails.isInRange(learned, "target") !== true) return undefined;
        return this.spellDetails.readUsability(learned).isUsable === true ? learned : undefined;
    }

    /** The player's debuffs on the target as the game shows them; undefined when it hides them (in a fight none proves nothing). */
    private readShownDebuffs(): AuraEntry[] | undefined {
        const scan = this.auras.scanAuras("target", "HARMFUL|PLAYER");
        if (scan.isUnreadable || (scan.auras.length === 0 && this.player.isInCombat())) return undefined;
        return scan.auras;
    }

    /** Is the debuff of this spell missing on the target, or about to run out? What the game shows corrects what was foreseen. */
    private isMissing(spellId: number, shown: AuraEntry[] | undefined): boolean {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return false;
        const key = buildNameKey(name);
        if (shown !== undefined && !this.secrecy.isAuraSecret(spellId)) {
            const aura = shown.find((entry) => entry.caster !== "other" && (entry.spellId === spellId || isSameName(entry.name, name)));
            if (aura?.duration !== undefined) this.memory.recordSeconds(key, aura.duration);
            this.memory.updateEnd(key, aura?.remain);
        }
        const end = this.memory.findEnd(key);
        const now = this.clock.getCurrentTime();
        return end === undefined || end <= now || isAboutToExpire(end - now, this.styles?.findBefore("missingDebuff", spellId) ?? 0);
    }
}
