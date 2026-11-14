// The player's spell casts, as one event. In combat the client hides the spell's ID, so the name
// seen at the start of the cast is used to find it.
import { type EventBus, OnGameEvent, OnUnitEvent } from "@wowkit/core";
import type { PlayerService } from "./player.service";
import type { SpellsService } from "./spells.service";
import { getReadable, getReadableId } from "./utils/secret-value.utils";

export interface PlayerSpellCast {
    /** The spell's ID; found by its name when the client hid the ID; undefined when unknown. */
    spellId: number | undefined;
    /** The spell's name from the start of the cast; undefined for instant spells or when hidden. */
    spellName: string | undefined;
}

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        /** The player finished casting a spell. */
        "player.spell-cast": [cast: PlayerSpellCast];
        /** A buff the player cast was refused: "A more powerful spell is already active" (a stronger one of its kind is up). */
        "player.cast-bounced": [spellId: number];
    }
}

/** A failed cast and its error come within this many seconds of each other. */
const FAILURE_MATCH_SECONDS = 0.5;

export class SpellCastService {
    private lastCastName: string | undefined;
    /** The player's last failed cast, and when the game last said a cast was refused for a stronger buff: they meet. */
    private lastFailed: { spellId: number; at: number } | undefined;
    private bouncedAt: number | undefined;

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly bus: EventBus,
    ) {}

    @OnUnitEvent("UNIT_SPELLCAST_START")
    noteCastStart(): void {
        this.lastCastName = this.player.getCastingSpellName() ?? this.lastCastName;
    }

    @OnUnitEvent("UNIT_SPELLCAST_FAILED")
    noteCastFailed(_unit: UnitToken, _castGuid: string, spellId: number | undefined): void {
        const id = getReadableId(spellId);
        this.lastFailed = id !== undefined ? { spellId: id, at: GetTime() } : undefined;
        this.matchBounce();
    }

    /** The game's error, compared with its own text for a stronger buff: the same in every client language. */
    @OnGameEvent("UI_ERROR_MESSAGE")
    noteError(_errorType: number, message: string): void {
        const bouncedText = (_G as unknown as { SPELL_FAILED_AURA_BOUNCED?: string }).SPELL_FAILED_AURA_BOUNCED;
        if (bouncedText === undefined || getReadable(message) !== bouncedText) return;
        this.bouncedAt = GetTime();
        this.matchBounce();
    }

    private matchBounce(): void {
        if (this.lastFailed === undefined || this.bouncedAt === undefined) return;
        if (math.abs(this.lastFailed.at - this.bouncedAt) > FAILURE_MATCH_SECONDS) return;
        this.bus.emit("player.cast-bounced", this.lastFailed.spellId);
        this.lastFailed = undefined;
        this.bouncedAt = undefined;
    }

    @OnUnitEvent("UNIT_SPELLCAST_SUCCEEDED")
    noteCastSucceeded(_unit: UnitToken, _castGuid: string, spellId: number | undefined): void {
        const spellName = this.lastCastName;
        this.lastCastName = undefined;
        const isHidden = spellId === undefined || issecretvalue(spellId);
        this.bus.emit("player.spell-cast", { spellId: isHidden ? this.spells.resolveFromName(spellName) : spellId, spellName });
    }
}
