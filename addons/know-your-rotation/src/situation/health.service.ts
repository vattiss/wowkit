// Health and the heals: how hurt a unit is (the client hides it often), which unit a heal would land on, and the smart
// heal threshold: a heal is offered once the missing health is about what it restores.
import type { CharacterService, SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import { OnEvent } from "@wowkit/core";
import type { StepOptions } from "../knowledge/step.interface";
import type { AddonSettingsService } from "../settings/settings.interface";

/** The smart threshold stays within these percents. */
const AUTO_MIN = 30;
const AUTO_MAX = 92;
/** Emergency steps (a threshold below this) keep their own value. */
const EMERGENCY = 50;

export class HealthService {
    /** The player's maximum health, remembered while readable (hidden in combat). */
    private playerMaxHealth: number | undefined;
    /** Spell ID -> what it heals (from its text), or false when the text has no number. */
    private readonly healAmounts = new LuaMap<number, number | false>();

    constructor(
        private readonly units: UnitsService,
        private readonly character: CharacterService,
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly settings: AddonSettingsService,
    ) {}

    @OnEvent("spells.invalidated")
    forgetHealAmounts(): void {
        for (const [id] of this.healAmounts) this.healAmounts.delete(id);
    }

    /** Health percent of the unit; 100 when the client hides it (see isHealthHidden). */
    getHealth(unit: UnitToken = "player"): number {
        return this.units.getHealthPercent(unit) ?? 100;
    }

    /** Does the client hide the unit's health, so no number can be compared? */
    isHealthHidden(unit: UnitToken = "player"): boolean {
        return this.units.getHealthPercent(unit) === undefined;
    }

    /** The player's maximum health; the last readable one while hidden. */
    getMaxHealth(unit: UnitToken = "player"): number | undefined {
        const max = this.units.getMaxHealth(unit);
        if (max !== undefined) {
            if (unit === "player") this.playerMaxHealth = max;
            return max;
        }
        return unit === "player" ? this.playerMaxHealth : undefined;
    }

    /** Is the player's mana hidden (combat), so a mana threshold cannot be compared? */
    isManaHidden(): boolean {
        return this.units.readPower("player", 0) === undefined;
    }

    /** The unit a press of a heal lands on: the forced unit, the mouseover (with mouseover cast on), a friendly target, the player. */
    findHealUnit(opt?: StepOptions): UnitToken {
        if (opt?.unit !== undefined && this.units.doesExist(opt.unit)) return opt.unit;
        if (this.character.isMouseoverCastOn() && this.units.isFriend("mouseover")) return "mouseover";
        if (this.units.isFriend("target")) return "target";
        return "player";
    }

    /** The health percent at or below which a heal is offered: about what it restores (emergency steps keep theirs). */
    getAutoHealThreshold(spellId: number, unit: UnitToken, fallback: number): number {
        if (!this.settings.get("isSmartHeal") || fallback < EMERGENCY) return fallback;
        const amount = this.getHealAmount(spellId);
        const maxHealth = this.getMaxHealth(unit);
        if (amount === undefined || maxHealth === undefined || maxHealth <= 0) return fallback;
        return math.min(AUTO_MAX, math.max(AUTO_MIN, 100 - (amount / maxHealth) * 100));
    }

    /** What the heal restores, from its text ("heals 120 to 140": 130); undefined until the text is loaded. */
    private getHealAmount(spellId: number): number | undefined {
        const id = this.spells.resolveOrSame(spellId);
        const cached = this.healAmounts.get(id);
        if (cached !== undefined) return cached === false ? undefined : cached;
        const text = this.details.getDescription(id);
        if (text === undefined) return undefined;
        const [plain] = string.gsub(string.lower(text), ",", "");
        const [low, high] = string.match(plain, "heal[^%d]*(%d+)%s+to%s+(%d+)");
        let amount: number | undefined;
        if (low !== undefined && high !== undefined) amount = (tonumber(low)! + tonumber(high)!) / 2;
        else amount = tonumber(string.match(plain, "heal[^%d]*(%d+)")[0]);
        this.healAmounts.set(id, amount ?? false);
        return amount;
    }
}
