// The role the lists are picked by. Automatic: from the talent tree with the most points (Protection: tank; Holy,
// Discipline, Restoration: heal), and for hunters and shamans from the distance to the target (melee or range). The
// druid's list also follows the form (cat, bear). And the combat mode: the AoE list once enough enemies fight the player.
import type { CharacterService, PlayerService } from "@wowkit/wow";
import { Druid } from "@wowkit/wow-data";
import { CLASS_ROLES } from "../knowledge/class-data.constants";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { AuraReaderService } from "../state/aura-reader.service";
import type { RangeService } from "./range.service";
import type { TargetService } from "./target.service";

/** Words of the talent tree names (an English client). */
const TANK_TREE_WORDS = ["protection"];
const HEAL_TREE_WORDS = ["restoration", "holy", "discipline"];
const TALENT_ROLE_CLASSES = ["WARRIOR", "PALADIN", "PRIEST", "SHAMAN", "DRUID"];

export class RoleService {
    /** The role detected last (kept while there is nothing to detect it from). */
    private detectedRole: string | undefined;

    constructor(
        private readonly player: PlayerService,
        private readonly character: CharacterService,
        private readonly settings: AddonSettingsService,
        private readonly target: TargetService,
        private readonly range: RangeService,
        private readonly auraReader: AuraReaderService,
    ) {}

    getClassToken(): string {
        return this.player.getClassToken() ?? "";
    }

    /** The roles of the player's class. */
    listRoles(): string[] {
        return CLASS_ROLES[this.getClassToken()] ?? ["damage"];
    }

    /** The role in use: the detected one when automatic, else the player's pick. */
    getRole(): string {
        if (!this.settings.get("isRoleAutomatic")) return this.resolveRole(this.settings.get("role"));
        this.detectedRole = this.detectRole() ?? this.detectedRole;
        return this.resolveRole(this.detectedRole);
    }

    /** The key of the list in use: the role, or for a druid the form's list (cat, bear). */
    getListKey(): string {
        const role = this.getRole();
        if (this.getClassToken() !== "DRUID") return role;
        if (role === "heal") return "heal";
        const isBear = this.auraReader.isFormActive(Druid.BearForm);
        if (role === "tank") return isBear ? "bear" : "tank";
        if (this.auraReader.isFormActive(Druid.CatForm)) return "cat";
        return isBear ? "bear" : "damage";
    }

    /** Is the AoE list in use? Only in combat: before a fight every hostile nameplate counts, and the pull is single target. */
    isAoeMode(): boolean {
        const mode = this.settings.get("combatMode");
        if (mode !== "auto") return mode === "aoe";
        if (!this.player.isInCombat()) return false;
        return this.target.countEnemies() >= math.max(2, this.settings.get("aoeFrom"));
    }

    /** A role of the class; an old or foreign one becomes the class's first. */
    resolveRole(role: string | undefined): string {
        const roles = this.listRoles();
        if (role !== undefined && roles.includes(role)) return role;
        return roles[0] ?? "damage";
    }

    private detectRole(): string | undefined {
        const token = this.getClassToken();
        const hasEnemy = this.target.isHostile();
        if (token === "HUNTER") return hasEnemy ? (this.range.isTargetInMelee() ? "melee" : "range") : undefined;
        if (!TALENT_ROLE_CLASSES.includes(token)) return undefined;
        const fromTalents = this.findTalentRole();
        if (fromTalents === "tank" || fromTalents === "heal") return fromTalents;
        if (token === "SHAMAN") return this.detectShamanRole(fromTalents, hasEnemy);
        // No talent data yet (low level): keep what was detected
        if (fromTalents === undefined) return undefined;
        return token === "DRUID" ? "hybrid" : "damage";
    }

    /** A damage shaman: caster at range, melee within reach of the target. */
    private detectShamanRole(fromTalents: string | undefined, hasEnemy: boolean): string | undefined {
        if (fromTalents === undefined && this.detectedRole === "heal") return undefined;
        if (!hasEnemy) return this.detectedRole === "heal" ? "caster" : undefined;
        return this.range.isTargetInMelee() ? "melee" : "caster";
    }

    private findTalentRole(): string | undefined {
        const tree = this.character.getMainTalentTree();
        if (tree === undefined) return undefined;
        const has = (words: string[]) => words.some((word) => string.find(tree, word, 1, true)[0] !== undefined);
        if (has(HEAL_TREE_WORDS)) return "heal";
        if (has(TANK_TREE_WORDS)) return "tank";
        return "damage";
    }
}
