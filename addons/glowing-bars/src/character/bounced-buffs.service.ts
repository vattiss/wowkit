// Buffs a stronger one keeps out (issue #68): a camp's Lodestone (+20 attack power) refuses a low Blessing of Might, and the
// game says "A more powerful spell is already active". Which buff is the stronger one the game does not say, so the buffs on
// the player at that moment are noted, and the reminder of the refused one stays quiet until one of them is gone: then it
// may glow again, and a new refusal notes it again. While the game hides the auras (a fight), it stays as it was.
import { OnEvent } from "@wowkit/core";
import { buildNameKey, type AurasService, type PlayerService, type SpellsService } from "@wowkit/wow";

export class BouncedBuffsService {
    /** Refused buff (name key) -> the buffs on the player when it was refused (name keys): one of them is the stronger one. */
    private readonly bounced = new LuaMap<string, string[]>();

    constructor(
        private readonly auras: AurasService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
    ) {}

    @OnEvent("player.cast-bounced")
    noteBounce(spellId: number): void {
        const key = this.findBuffKey(spellId);
        const onPlayer = this.readBuffKeys();
        if (key === undefined || onPlayer === undefined) return;
        const kept: string[] = [];
        for (const buffKey of onPlayer) kept.push(buffKey);
        this.bounced.set(key, kept);
    }

    /** Is this buff kept out by a stronger one, still on the player? */
    isBounced(spellId: number): boolean {
        const key = this.findBuffKey(spellId);
        const kept = key !== undefined ? this.bounced.get(key) : undefined;
        if (key === undefined || kept === undefined) return false;
        const onPlayer = this.readBuffKeys();
        // Hidden in a fight: as it was
        if (onPlayer === undefined) return true;
        if (kept.every((buffKey) => onPlayer.has(buffKey))) return true;
        this.bounced.delete(key);
        return false;
    }

    /** Every rank of a buff goes by its name. */
    private findBuffKey(spellId: number): string | undefined {
        const name = this.spells.getSpellName(spellId);
        return name !== undefined && name !== "" ? buildNameKey(name) : undefined;
    }

    /** The buffs on the player by name key; undefined while the game hides any of them, or all (an empty list in a fight). */
    private readBuffKeys(): LuaSet<string> | undefined {
        const scan = this.auras.scanAuras("player");
        if (scan.isUnreadable || scan.auras.some((aura) => aura.isHidden || aura.name === undefined)) return undefined;
        if (scan.auras.length === 0 && this.player.isInCombat()) return undefined;
        const keys = new LuaSet<string>();
        for (const aura of scan.auras) keys.add(buildNameKey(aura.name!));
        return keys;
    }
}
