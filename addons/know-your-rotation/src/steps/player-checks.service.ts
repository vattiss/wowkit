// The conditions of a step about the player: level, combat, pet, group, form, combo points, mana and health, and what
// the player has learned.
import type { CharacterService, PlayerService, SpellDetailsService, SpellsService, UnitsService } from "@wowkit/wow";
import type { AuraReaderService } from "../state/aura-reader.service";
import type { ComboService } from "../state/combo.service";
import type { CombatErrorsService } from "../state/combat-errors.service";
import type { TotemTrackerService } from "../state/totem-tracker.service";
import type { HealthService } from "../situation/health.service";
import type { TargetService } from "../situation/target.service";
import type { StepContext } from "./step-check.interface";

export class PlayerChecksService {
    constructor(
        private readonly player: PlayerService,
        private readonly character: CharacterService,
        private readonly units: UnitsService,
        private readonly spells: SpellsService,
        private readonly details: SpellDetailsService,
        private readonly target: TargetService,
        private readonly health: HealthService,
        private readonly auraReader: AuraReaderService,
        private readonly combo: ComboService,
        private readonly totems: TotemTrackerService,
        private readonly errors: CombatErrorsService,
    ) {}

    /** Some spells only pay off later while leveling (longer fights, a bigger mana pool). */
    checkMinLevel(c: StepContext): string | undefined {
        const level = this.character.getLevel();
        return level !== undefined && level < c.opt.minLevel! ? `from level ${c.opt.minLevel}` : undefined;
    }

    /** A lower-level stand-in (Stoneskin Totem until Strength of Earth Totem is worth its mana). */
    checkMaxLevel(c: StepContext): string | undefined {
        const level = this.character.getLevel();
        return level !== undefined && level > c.opt.maxLevel! ? `up to level ${c.opt.maxLevel}` : undefined;
    }

    /** Turning an auto-repeat attack on, never while it runs (pressing it again would stop it). */
    checkAutoRepeat(c: StepContext): string | undefined {
        return this.details.isAutoRepeating(c.id) ? "already on" : undefined;
    }

    /** Fight-only buffs: in combat, or right before a pull with an enemy targeted. Never while just walking around. */
    checkFight(): string | undefined {
        return this.player.isInCombat() || this.target.isHostile() ? undefined : "only in combat or with an enemy targeted";
    }

    checkEnemyTarget(): string | undefined {
        return this.target.isHostile() ? undefined : "only with an enemy targeted";
    }

    checkKnownAny(c: StepContext): string | undefined {
        return c.opt.needKnownAny!.some((id) => this.spells.isLearned(id)) ? undefined : "nothing to use it for yet";
    }

    checkTotem(c: StepContext): string | undefined {
        return this.totems.getTotemRemaining(c.id) > (c.opt.refresh ?? 1) ? "totem already up" : undefined;
    }

    checkNotKnown(c: StepContext): string | undefined {
        return this.spells.isLearned(c.opt.notKnown) ? "a better spell is learned" : undefined;
    }

    checkNotTree(c: StepContext): string | undefined {
        const tree = this.character.getMainTalentTree();
        return tree !== undefined && string.find(tree, c.opt.notTree!, 1, true)[0] !== undefined ? "not for your talent tree" : undefined;
    }

    checkSwimming(): string | undefined {
        return this.player.isSwimming() ? undefined : "only while swimming";
    }

    /** Threat drops (Fade, Feint, Disengage) do nothing with nobody else around. */
    checkGroup(c: StepContext): string | undefined {
        if (this.character.isInGroup()) return undefined;
        return c.opt.isAlsoWithPet === true && this.units.doesExist("pet") ? undefined : "only in a group";
    }

    checkPetDead(): string | undefined {
        return this.errors.isPetDead() ? undefined : "your pet is not dead";
    }

    checkPetAlive(): string | undefined {
        return this.errors.isPetDead() ? "your pet is dead" : undefined;
    }

    checkForm(c: StepContext): string | undefined {
        return this.auraReader.isFormActive(c.opt.form!) ? undefined : "wrong form or stance";
    }

    checkNoForm(c: StepContext): string | undefined {
        return this.auraReader.isFormActive(c.opt.noForm!) ? "not in this form or stance" : undefined;
    }

    checkCombat(): string | undefined {
        return this.player.isInCombat() ? undefined : "only in combat";
    }

    checkOutOfCombat(): string | undefined {
        return this.player.isInCombat() ? "only out of combat" : undefined;
    }

    checkCombo(c: StepContext): string | undefined {
        if (this.combo.getComboPoints() >= c.opt.comboMin!) return undefined;
        return `not enough combo points (${this.combo.describeComboPoints()}, need ${c.opt.comboMin})`;
    }

    checkPet(): string | undefined {
        return this.units.doesExist("pet") ? undefined : "needs your pet";
    }

    checkNoPet(): string | undefined {
        return this.units.doesExist("pet") ? "pet is already out" : undefined;
    }

    /** A client that does not say counts as having one (Call Pet is better offered once too often than never). */
    checkTamedPet(): string | undefined {
        return this.character.hasTamedPet() !== false ? undefined : "no tamed pet yet";
    }

    checkManaMax(c: StepContext): string | undefined {
        if (c.opt.isManaUnchecked === true) return undefined;
        const mana = this.units.readPower("player", 0);
        // Hidden in combat: the glow faded by the client shows it instead
        if (mana === undefined) return "mana is hidden right now";
        return mana.max <= 0 || (mana.current / mana.max) * 100 > c.opt.manaMax! ? "mana is still high" : undefined;
    }

    checkHealthMin(c: StepContext): string | undefined {
        return this.health.getHealth(c.opt.unit ?? "player") < c.opt.hpMin! ? "health too low for it" : undefined;
    }
}
