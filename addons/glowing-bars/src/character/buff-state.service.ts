// Is a buff up on the player or on a party member? Put together from the auras the game shows (AurasService of
// @wowkit/wow), the buff categories (any aspect counts for an aspect, a group version for the single buff) and the
// memory that fills in while the client hides the player's auras in combat.
import {
    type AuraEntry,
    type AuraRead,
    type AurasService,
    type PlayerService,
    type SpellsService,
    isReadable,
    buildNameKey,
} from "@wowkit/wow";
import type { BuffCategory } from "../knowledge/buff-categories.constants";
import type { BuffKnowledgeService } from "../knowledge/buff-knowledge.service";
import type { BuffMemoryService } from "./buff-memory.service";

export interface BuffRead extends AuraRead {
    /** The buff categories seen in the scan (category key -> aura). */
    categories?: LuaMap<string, AuraEntry>;
}

export type UnitBuffState = "has" | "missing" | "unknown";

export class BuffStateService {
    constructor(
        private readonly auras: AurasService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly memory: BuffMemoryService,
        private readonly knowledge: BuffKnowledgeService,
    ) {}

    wipeAuraScans(): void {
        this.auras.wipeAuraScans();
    }

    wipeAuraScan(unit: string | undefined): void {
        this.auras.wipeAuraScan(unit);
    }

    /** What the game shows of a buff on the player, without the memory: asked directly, then looked for in the list. */
    findAura(spellId: number | undefined): BuffRead {
        if (spellId === undefined) return { isFound: false, remain: 0, isUnreadable: false };
        return this.auras.readPlayerAura(spellId) ?? this.readFromScan(spellId);
    }

    /** Is the buff on the player, counting the remembered state while the client hides auras? */
    hasAura(spellId: number): boolean {
        const read = this.findAura(spellId);
        if (read.isFound) {
            this.memory.remember(spellId, undefined, read.remain, false);
            return true;
        }
        // The client hides auras in combat (none at all, or some whose name and ID are secret): a buff we saw or cast is
        // trusted until it runs out. A list it shows in full is believed, in combat too: a buff the player cancelled is gone.
        if (read.isUnreadable) return this.memory.isRemembered(spellId);
        this.memory.release(spellId, read.categories);
        return false;
    }

    /** The player cast a spell: if it is a buff on the player, it is up now. */
    noteSelfBuff(spellId: number | undefined): void {
        if (spellId === undefined || !isReadable(spellId)) return;
        this.memory.remember(spellId, undefined, undefined, true);
    }

    /** A shapeshift happened. */
    noteFormChange(): void {
        this.memory.forgetForms();
        this.auras.wipeAuraScans();
    }

    /**
     * Does another unit (a party member) have the buff, or another buff of its category (Prayer of
     * Fortitude for Fortitude)? `isOwnOnly`: only an aura the player cast counts. "unknown" when the client hid
     * the auras: there is no memory for other units, so a hidden aura never counts as missing.
     */
    getUnitBuffState(unit: UnitToken, spellId: number, isOwnOnly: boolean): UnitBuffState {
        const wantName = this.getBuffName(spellId);
        if (wantName === undefined) return "unknown";
        const wantKey = buildNameKey(wantName);
        const wantCategory = this.knowledge.findCategory(wantName);
        const scan = this.auras.scanAuras(unit);
        let isUnreadable = scan.isUnreadable;
        for (const aura of scan.auras) {
            const verdict = this.judgeUnitAura(aura, wantKey, wantCategory, isOwnOnly);
            if (verdict === "has") return "has";
            if (verdict === "hidden") isUnreadable = true;
        }
        return isUnreadable ? "unknown" : "missing";
    }

    /** What one aura of another unit says about the wanted buff: it is the buff, it hides what it is, or it is another one. */
    private judgeUnitAura(
        aura: AuraEntry,
        wantKey: string,
        wantCategory: BuffCategory | undefined,
        isOwnOnly: boolean,
    ): "has" | "hidden" | "other" {
        if (aura.isHidden || aura.name === undefined) return "hidden";
        const isWanted =
            buildNameKey(aura.name) === wantKey || (wantCategory !== undefined && this.knowledge.findCategory(aura.name) === wantCategory);
        if (!isWanted) return "other";
        if (!isOwnOnly || aura.caster === "player") return "has";
        return aura.caster === "hidden" ? "hidden" : "other";
    }

    /** The name the client gives the buff (the rank the player knows first). */
    private getBuffName(spellId: number): string | undefined {
        return this.spells.getSpellName(this.spells.resolve(spellId) ?? spellId) ?? this.spells.getSpellName(spellId);
    }

    /** Looks for the buff in the list of the player's auras: by name, by ID, then by its buff category. */
    private readFromScan(spellId: number): BuffRead {
        const resolved = this.spells.resolve(spellId);
        const wantName = this.getBuffName(spellId);
        const scan = this.auras.scanAuras("player");
        // No auras at all while buffs are remembered, in combat or with a target, or an aura whose name is secret: the client
        // hides them, and the buff may be one of them
        const hasHiddenAura = scan.auras.some((aura) => aura.isHidden || aura.name === undefined);
        const isUnreadable = scan.isUnreadable || hasHiddenAura || (scan.auras.length === 0 && this.isEmptyListSuspicious());
        const { names, ids, categories } = this.indexAuras(scan.auras);
        const wantCategory = this.knowledge.findCategory(wantName);
        const aura =
            (wantName !== undefined ? names.get(buildNameKey(wantName)) : undefined) ??
            (resolved !== undefined ? ids.get(resolved) : undefined) ??
            ids.get(spellId) ??
            (wantCategory ? categories.get(wantCategory.key) : undefined);
        if (aura) return { isFound: true, remain: aura.remain, isUnreadable: false, categories };
        return { isFound: false, remain: 0, isUnreadable, categories };
    }

    /** The readable auras by name key, by ID, and by buff category. */
    private indexAuras(auras: AuraEntry[]): {
        names: LuaMap<string, AuraEntry>;
        ids: LuaMap<number, AuraEntry>;
        categories: LuaMap<string, AuraEntry>;
    } {
        const names = new LuaMap<string, AuraEntry>();
        const ids = new LuaMap<number, AuraEntry>();
        const categories = new LuaMap<string, AuraEntry>();
        for (const aura of auras) {
            if (aura.isHidden) continue;
            if (aura.spellId !== undefined) ids.set(aura.spellId, aura);
            if (aura.name === undefined) continue;
            names.set(buildNameKey(aura.name), aura);
            const category = this.knowledge.findCategory(aura.name);
            if (category) categories.set(category.key, aura);
        }
        return { names, ids, categories };
    }

    /** No auras at all while we remember some, in combat or with a target: the client hides them rather than the player having none. */
    private isEmptyListSuspicious(): boolean {
        return !this.memory.isEmpty() && (this.player.isInCombat() || this.player.hasTarget());
    }
}
