// Is a buff up on the player or on a party member? Put together from the auras the game shows (AurasService of
// @wowkit/wow), the buff categories (any aspect counts for an aspect, a group version for the single buff) and the
// memory that fills in while the client hides the player's auras in combat.
import {
    type AuraEntry,
    type AuraRead,
    type AuraScan,
    type AurasService,
    type CooldownViewerService,
    type PlayerService,
    type SpellsService,
    isReadable,
    buildNameKey,
    hasKnownExpiry,
    isSameName,
} from "@wowkit/wow";
import { Consumable, Warlock, Warrior } from "@wowkit/wow-data";
import type { BuffCategory } from "../knowledge/buff-categories.constants";
import type { BuffKnowledgeService } from "../knowledge/buff-knowledge.service";
import type { BuffMemoryService } from "./buff-memory.service";
import type { HiddenBuffsService } from "./hidden-buffs.service";

export interface BuffRead extends AuraRead {
    /** The buff categories seen in the scan (category key -> aura). */
    categories?: LuaMap<string, AuraEntry>;
    /** Found as another buff of its category (any aspect for an aspect), not as itself. */
    isCategoryMember?: boolean;
}

/** A scan of the player's auras indexed for the lookups of a tick. */
interface AuraIndex {
    scan: AuraScan;
    names: LuaMap<string, AuraEntry>;
    ids: LuaMap<number, AuraEntry>;
    categories: LuaMap<string, AuraEntry>;
    hasHiddenAura: boolean;
}

export type UnitBuffState = "has" | "missing" | "unknown";

/** A buff on the player at a lower rank than the player knows, cast by the player or by another. */
export interface OlderRankBuff {
    spellId: number;
    name: string;
    rank: number;
    /** The highest rank the player knows. */
    best: number;
    caster: "player" | "other";
    remain: number;
}

/** Shield Block ends after this many blocks (its stacks on Forever), or when its time is up. */
const SHIELD_BLOCK_CHARGES = 2;

export class BuffStateService {
    /** The blocks Shield Block has left since it was cast; 0 when it is not up. */
    private shieldBlockCharges = 0;
    /** The buffs last seen cast by someone else (by name key): an icon only follows the player's own casts. */
    private readonly fromOthers = new LuaSet<string>();
    /** The spell ID of each buff (by name key) last seen on the player or cast: the rank it is of. */
    private readonly auraIds = new LuaMap<string, number>();
    /** The answer of the last look at each buff of hasPerCasterBuff (by spell ID): it holds while the client hides auras. */
    private readonly perCasterVerdicts = new LuaMap<number, boolean>();
    /** The auras of the last scan looked up, indexed (see indexAuras). */
    private indexed: AuraIndex | undefined;

    constructor(
        private readonly auras: AurasService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly memory: BuffMemoryService,
        private readonly knowledge: BuffKnowledgeService,
        private readonly cooldownViewer: CooldownViewerService,
        private readonly hidden: HiddenBuffsService,
    ) {}

    wipeAuraScans(): void {
        this.auras.wipeAuraScans();
    }

    wipeAuraScan(unit: string | undefined): void {
        this.auras.wipeAuraScan(unit);
    }

    /**
     * What the game shows of a buff on the player, without the memory: asked directly, then looked for in the list. A direct
     * question the client refused to answer leaves "not found" unproven.
     */
    findAura(spellId: number | undefined): BuffRead {
        if (spellId === undefined) return { isFound: false, remain: 0, isUnreadable: false };
        const direct = this.auras.readPlayerAura(spellId);
        if (direct?.isFound === true) return direct;
        const scanned = this.readFromScan(spellId);
        if (direct?.isUnreadable === true && !scanned.isFound) scanned.isUnreadable = true;
        return scanned;
    }

    /**
     * Is the buff on the player, counting the remembered state while the client hides auras? `lead`: a buff with no more
     * than this many seconds left counts as gone already, so its reminder comes in time to cast it again.
     */
    hasAura(spellId: number, lead = 0): boolean {
        const read = this.findAura(spellId);
        if (read.isFound) {
            this.noteBuffCaster(spellId, read.caster);
            if (read.spellId !== undefined) this.auraIds.set(this.getBuffKey(spellId), read.spellId);
            // Seen as itself, not as another of its category: only that tells the game shows it
            if (read.isCategoryMember !== true) {
                this.hidden.noteSeen(spellId, this.getBuffKey(spellId), read.caster === "player" ? read.duration : undefined);
            }
            this.memory.remember(spellId, undefined, read.remain, false);
            return lead === 0 || !hasKnownExpiry(read.remain) || read.remain > lead;
        }
        // The client hides auras in combat (none at all, or some whose name and ID are secret), or may keep this one secret
        // (a dungeon) in a list that looks whole: a buff we saw or cast is trusted until it runs out. Otherwise a list it
        // shows in full is believed, in combat too: a buff the player cancelled is gone.
        if (read.isUnreadable || this.hidden.isAbsenceDoubtful(spellId, this.getBuffKey(spellId)))
            return this.isHiddenBuffUp(spellId, lead);
        this.memory.release(spellId, read.categories);
        return false;
    }

    /** The auras of the buff's name on the player (their IDs may differ); undefined while the client hides auras. */
    findAuras(spellId: number): AuraEntry[] | undefined {
        const scan = this.auras.scanAuras("player");
        if (scan.isUnreadable || scan.auras.some((aura) => aura.isHidden || aura.name === undefined)) return undefined;
        if (scan.auras.length === 0 && this.isEmptyListSuspicious()) return undefined;
        const wantKey = buildNameKey(this.getBuffName(spellId) ?? "");
        const found = scan.auras.filter((aura) => buildNameKey(aura.name!) === wantKey);
        // None in a list that looks whole, where the client may keep the buff secret (a dungeon): that proves nothing
        return found.length === 0 && this.hidden.isAbsenceDoubtful(spellId, wantKey) ? undefined : found;
    }

    /**
     * The buffs on the player at a lower rank than the highest the player knows, out of combat: in a fight the game hides their
     * IDs, so undefined there. Any buff with ranks the player can cast, not only those the addon reminds of.
     */
    findOlderRankBuffs(): OlderRankBuff[] | undefined {
        if (this.player.isInCombat()) return undefined;
        const found: OlderRankBuff[] = [];
        for (const aura of this.auras.scanAuras("player").auras) {
            if (aura.isHidden || aura.spellId === undefined || aura.name === undefined || aura.caster === "hidden") continue;
            const rank = this.spells.getSpellRank(aura.spellId);
            const best = rank !== undefined ? this.spells.getHighestRank(aura.spellId) : undefined;
            if (rank === undefined || best === undefined || rank >= best) continue;
            found.push({ spellId: aura.spellId, name: aura.name, rank, best, caster: aura.caster, remain: aura.remain });
        }
        return found;
    }

    /**
     * Is a buff of which each caster keeps one on a target (a paladin's blessing or aura) up on the player, as the player's own
     * counts? The same buff or its group version (`sameIds`: a Greater Blessing) from anyone, as they do not stack; another of
     * its category only the player's own, as the others' stack with it. While the client hides auras (a fight), the answer of
     * the last look holds.
     */
    hasPerCasterBuff(spellId: number, sameIds: number[], lead = 0): boolean {
        const scan = this.auras.scanAuras("player");
        const isUnreadable =
            scan.isUnreadable ||
            scan.auras.some((aura) => aura.isHidden || aura.name === undefined) ||
            (scan.auras.length === 0 && this.isEmptyListSuspicious());
        if (isUnreadable) return this.perCasterVerdicts.get(spellId) ?? this.hasAura(spellId, lead);
        const sameKeys = [spellId, ...sameIds].map((id) => this.getBuffKey(id));
        const category = this.knowledge.findCategory(this.getBuffName(spellId), spellId);
        const isUp = scan.auras.some((aura) => this.isPerCasterCounted(aura, sameKeys, category, lead));
        if (!isUp && this.isPerCasterAbsenceDoubtful(spellId)) return this.isOwnPerCasterUp(spellId, lead);
        this.perCasterVerdicts.set(spellId, isUp);
        return isUp;
    }

    /**
     * Not in a list that looks whole, yet maybe up: the client answers a direct question about it with something (an aura
     * whose fields are secret, or a refusal), or may keep it secret here. What was seen or cast then decides, as in a fight.
     */
    private isPerCasterAbsenceDoubtful(spellId: number): boolean {
        const direct = this.auras.readPlayerAura(spellId);
        return direct !== undefined || this.hidden.isAbsenceDoubtful(spellId, this.getBuffKey(spellId));
    }

    /**
     * The player's own buff of a kind each caster keeps one of, where the list may not show it: asked directly by its spell,
     * else the answer of the last look the list could be believed at, or the player's cast since (see notePerCasterCast). Never
     * another buff of its category: another paladin's Kings is no blessing of the player's.
     */
    private isOwnPerCasterUp(spellId: number, lead: number): boolean {
        const direct = this.auras.readPlayerAura(spellId);
        if (direct?.isFound === true) return lead === 0 || !hasKnownExpiry(direct.remain) || direct.remain > lead;
        return this.perCasterVerdicts.get(spellId) ?? this.isHiddenBuffUp(spellId, lead);
    }

    /** One aura of the player, for hasPerCasterBuff: the same buff from anyone, or another of the player's own, still up. */
    private isPerCasterCounted(aura: AuraEntry, sameKeys: string[], category: BuffCategory | undefined, lead: number): boolean {
        const isSame = sameKeys.includes(buildNameKey(aura.name!));
        const isOwnOther =
            aura.caster === "player" && category !== undefined && this.knowledge.findCategory(aura.name, aura.spellId) === category;
        return (isSame || isOwnOther) && (lead === 0 || !hasKnownExpiry(aura.remain) || aura.remain > lead);
    }

    /** The player cast a spell: if it is a buff on the player, it is up now. */
    noteSelfBuff(spellId: number | undefined): void {
        if (spellId === undefined || !isReadable(spellId)) return;
        this.memory.remember(spellId, undefined, undefined, true);
        this.fromOthers.delete(this.getBuffKey(spellId));
        this.auraIds.set(this.getBuffKey(spellId), spellId);
        this.notePerCasterCast(spellId);
        if (isSameName(this.spells.getSpellName(spellId), this.spells.getSpellName(Warrior.ShieldBlock)))
            this.shieldBlockCharges = SHIELD_BLOCK_CHARGES;
    }

    /**
     * A blessing or a paladin aura cast: the player's own of its category is up now, for hasPerCasterBuff while the client
     * hides auras (a fight). The next look out of combat reads them again.
     */
    private notePerCasterCast(spellId: number): void {
        const category = this.knowledge.findCategory(this.getBuffName(spellId), spellId);
        if (category === undefined) return;
        for (const [id] of this.perCasterVerdicts) {
            if (this.knowledge.findCategory(this.getBuffName(id), id) === category) this.perCasterVerdicts.set(id, true);
        }
    }

    /** The player blocked: a charge of Shield Block is used, and with the last one it is gone, before its time. */
    noteBlock(): void {
        if (this.shieldBlockCharges === 0) return;
        this.shieldBlockCharges -= 1;
        if (this.shieldBlockCharges === 0) this.memory.forget(Warrior.ShieldBlock);
    }

    /** The player's pet came or went: Soul Link was on the demon before, and goes with it, also in a fight. */
    notePetChange(): void {
        this.memory.forget(Warlock.SoulLink);
    }

    /** The answers of the buffs each caster keeps one of (by spell ID), for the saved settings (a /reload). */
    buildPerCasterVerdicts(): { [spellId: string]: boolean } {
        const verdicts: { [spellId: string]: boolean } = {};
        for (const [id, isUp] of this.perCasterVerdicts) verdicts[string.format("%d", id)] = isUp;
        return verdicts;
    }

    /** Takes back the answers a /reload saved. */
    restorePerCasterVerdicts(verdicts: { [spellId: string]: boolean }): void {
        for (const [id, isUp] of pairs(verdicts)) {
            const spellId = tonumber(id);
            if (spellId !== undefined) this.perCasterVerdicts.set(spellId, isUp);
        }
    }

    /** The spells the player added to a category's type (seals of their own): they count for the category, and last as long. */
    useAddedCategoryMembers(categoryKey: string, spellIds: number[]): void {
        this.knowledge.useAddedMembers(categoryKey, spellIds);
    }

    /** The player died: the class buffs and Well Fed are gone for sure; of any other (a flask stays) nothing is known. */
    noteDeath(): void {
        const wellFed = this.spells.getSpellLabel(Consumable.WellFed);
        this.memory.forgetOnDeath((name) => name === wellFed || this.knowledge.isLostOnDeath(undefined, name));
        // A blessing or a paladin's aura goes with death too, the player's own and the others'
        for (const [id] of this.perCasterVerdicts) this.perCasterVerdicts.set(id, false);
    }

    /** The buff was renewed without showing its new end (a food eaten where Well Fed may be kept secret). */
    forgetBuffEnd(spellId: number): void {
        this.memory.forgetEnd(spellId);
    }

    /** A shapeshift happened. */
    noteFormChange(): void {
        this.memory.forgetForms();
        this.auras.wipeAuraScans();
    }

    /**
     * Does another unit (a party member) have the buff, or another buff of its category (Prayer of
     * Fortitude for Fortitude)? `isOwnOnly` (a blessing): the same buff or its group version (`sameIds`) counts from anyone,
     * as they do not stack, another of its category only if the player cast it. "unknown" when the client hid the auras: there
     * is no memory for other units, so a hidden aura never counts as missing.
     */
    getUnitBuffState(unit: UnitToken, spellId: number, isOwnOnly: boolean, sameIds: number[] = []): UnitBuffState {
        const wantName = this.getBuffName(spellId);
        if (wantName === undefined) return "unknown";
        const wantKeys = [buildNameKey(wantName), ...sameIds.map((id) => this.getBuffKey(id))];
        const wantCategory = this.knowledge.findCategory(wantName, spellId);
        const scan = this.auras.scanAuras(unit);
        let isUnreadable = scan.isUnreadable;
        for (const aura of scan.auras) {
            const verdict = this.judgeUnitAura(aura, wantKeys, wantCategory, isOwnOnly);
            if (verdict === "has") return "has";
            if (verdict === "hidden") isUnreadable = true;
        }
        // Where the game may keep the buff secret (a dungeon), its absence from a member's list proves nothing: their casts are not seen
        return isUnreadable || this.hidden.isAuraSecret(spellId) ? "unknown" : "missing";
    }

    /**
     * Which of these buffs the player put on another unit: the key of the first whose spells (the buff, its group
     * version) name an aura the player cast on it; undefined for none, or while the client hides the auras.
     */
    findOwnUnitBuff(unit: UnitToken, buffs: [key: number, spellIds: number[]][]): number | undefined {
        for (const aura of this.auras.scanAuras(unit).auras) {
            if (aura.isHidden || aura.name === undefined || aura.caster !== "player") continue;
            const auraKey = buildNameKey(aura.name);
            for (const [key, spellIds] of buffs) {
                if (
                    spellIds.some(
                        (id) => isSameName(this.getBuffName(id), aura.name) || buildNameKey(this.spells.getHintName(id) ?? "") === auraKey,
                    )
                )
                    return key;
            }
        }
        return undefined;
    }

    /** What one aura of another unit says about the wanted buff: it is the buff, it hides what it is, or it is another one. */
    private judgeUnitAura(
        aura: AuraEntry,
        wantKeys: string[],
        wantCategory: BuffCategory | undefined,
        isOwnOnly: boolean,
    ): "has" | "hidden" | "other" {
        if (aura.isHidden || aura.name === undefined) return "hidden";
        const isSame = wantKeys.includes(buildNameKey(aura.name));
        const isOfCategory = wantCategory !== undefined && this.knowledge.findCategory(aura.name, aura.spellId) === wantCategory;
        if (!isSame && !isOfCategory) return "other";
        // The same blessing from another paladin does not stack with the player's: it counts as well
        if (!isOwnOnly || isSame || aura.caster === "player") return "has";
        return aura.caster === "hidden" ? "hidden" : "other";
    }

    /**
     * Is a buff the client hides up? The icons in the Cooldown Manager know; the memory says how long it has left, and is all
     * there is without an icon.
     */
    private isHiddenBuffUp(spellId: number, lead: number): boolean {
        const isIconUp = this.readBuffIcons(spellId);
        if (isIconUp === false && !this.fromOthers.has(this.getBuffKey(spellId))) return false;
        if (isIconUp === true && !this.memory.isRemembered(spellId)) return true;
        const isSecret = this.hidden.isAuraSecret(spellId);
        if (isSecret && this.memory.isLengthUnknown(spellId))
            this.hidden.noteUnfollowed(this.getBuffKey(spellId), this.getBuffName(spellId) ?? "?");
        if (this.memory.isRemembered(spellId, lead)) return true;
        // Its end not known (cast with no known length, renewed out of sight), or nothing known of one kept secret: not asked
        // for, rather than while it may be up
        return this.memory.isEndUnknown(spellId) || (isSecret && !this.memory.hasRecord(spellId));
    }

    /**
     * What the icons say of a buff: of a category, of every member the player knows, as any of them counts. A member with no
     * icon has no say: one icon can stand for several buffs (Blessing of Might's is also Greater Blessing of Might's).
     * Undefined when no member has an icon.
     */
    private readBuffIcons(spellId: number): boolean | undefined {
        const name = this.getBuffName(spellId);
        // Every shapeshift form shares one icon, which is up in any of them
        if (name === undefined || this.knowledge.isFormKey(buildNameKey(name))) return undefined;
        const category = this.knowledge.findCategory(name);
        const ids = category !== undefined ? category.members.filter((id) => this.spells.isLearned(id)) : [spellId];
        if (ids.length === 0) return undefined;
        let hasIcon = false;
        for (const id of ids) {
            const isUp = this.cooldownViewer.isBuffActive(this.getBuffName(id) ?? "", this.auraIds.get(this.getBuffKey(id)));
            if (isUp === true) return true;
            if (isUp === false) hasIcon = true;
        }
        return hasIcon ? false : undefined;
    }

    private getBuffKey(spellId: number): string {
        return buildNameKey(this.getBuffName(spellId) ?? "");
    }

    private noteBuffCaster(spellId: number, caster: AuraRead["caster"]): void {
        if (caster === "other") this.fromOthers.add(this.getBuffKey(spellId));
        else if (caster === "player") this.fromOthers.delete(this.getBuffKey(spellId));
    }

    /** The name the client gives the buff (the rank the player knows first). */
    private getBuffName(spellId: number): string | undefined {
        return this.spells.getSpellName(this.spells.resolve(spellId) ?? spellId) ?? this.spells.getSpellLabel(spellId);
    }

    /** Looks for the buff in the list of the player's auras: by name, by ID, then by its buff category. */
    private readFromScan(spellId: number): BuffRead {
        const resolved = this.spells.resolve(spellId);
        const wantName = this.getBuffName(spellId);
        const scan = this.auras.scanAuras("player");
        // No auras at all in combat while buffs are remembered, or an aura whose name is secret: the client hides them, and
        // the buff may be one of them
        const { names, ids, categories, hasHiddenAura } = this.indexAuras(scan);
        const isUnreadable = scan.isUnreadable || hasHiddenAura || (scan.auras.length === 0 && this.isEmptyListSuspicious());
        const wantCategory = this.knowledge.findCategory(wantName, spellId);
        const own =
            (wantName !== undefined ? names.get(buildNameKey(wantName)) : undefined) ??
            (resolved !== undefined ? ids.get(resolved) : undefined) ??
            ids.get(spellId);
        const aura = own ?? (wantCategory ? categories.get(wantCategory.key) : undefined);
        if (aura) {
            const { remain, caster, duration } = aura;
            const isCategoryMember = own === undefined;
            return { isFound: true, remain, isUnreadable: false, caster, spellId: aura.spellId, duration, categories, isCategoryMember };
        }
        return { isFound: false, remain: 0, isUnreadable, categories };
    }

    /**
     * The readable auras of a scan by name key, by ID, and by buff category, and whether one hides its name. Worked out once
     * for each scan: every buff of a tick is looked up in the same one.
     */
    private indexAuras(scan: AuraScan): AuraIndex {
        if (this.indexed?.scan === scan) return this.indexed;
        const names = new LuaMap<string, AuraEntry>();
        const ids = new LuaMap<number, AuraEntry>();
        const categories = new LuaMap<string, AuraEntry>();
        const index: AuraIndex = { scan, names, ids, categories, hasHiddenAura: false };
        this.indexed = index;
        for (const aura of scan.auras) {
            if (aura.isHidden || aura.name === undefined) index.hasHiddenAura = true;
            if (aura.isHidden) continue;
            if (aura.spellId !== undefined) ids.set(aura.spellId, aura);
            if (aura.name === undefined) continue;
            names.set(buildNameKey(aura.name), aura);
            const category = this.knowledge.findCategory(aura.name, aura.spellId);
            if (category) categories.set(category.key, aura);
        }
        return index;
    }

    /**
     * No auras at all in combat while we remember some: the client hides them rather than the player having none. Out of
     * combat it shows them, with a target too: an empty list is no aura (a cancelled one).
     */
    private isEmptyListSuspicious(): boolean {
        return !this.memory.isEmpty() && this.player.isInCombat();
    }
}
