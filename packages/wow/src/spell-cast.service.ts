// The player's spell casts, as one event. In combat the client hides the spell's ID, so the name
// seen at the start of the cast is used to find it.
import { type EventBus, OnUnitEvent } from "@wowkit/framework";
import type { PlayerService } from "./player.service";
import type { SpellsService } from "./spells.service";

export interface PlayerSpellCast {
    /** The spell's ID; found by its name when the client hid the ID; undefined when unknown. */
    spellId: number | undefined;
    /** The spell's name from the start of the cast; undefined for instant spells or when hidden. */
    spellName: string | undefined;
}

declare module "@wowkit/framework/event-bus" {
    interface AppEvents {
        /** The player finished casting a spell. */
        "player.spell-cast": [cast: PlayerSpellCast];
    }
}

export class SpellCastService {
    private lastCastName: string | undefined;

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly bus: EventBus,
    ) {}

    @OnUnitEvent("UNIT_SPELLCAST_START")
    noteCastStart(): void {
        this.lastCastName = this.player.getCastingSpellName() ?? this.lastCastName;
    }

    @OnUnitEvent("UNIT_SPELLCAST_SUCCEEDED")
    noteCastSucceeded(_unit: UnitToken, _castGuid: string, spellId: number | undefined): void {
        const spellName = this.lastCastName;
        this.lastCastName = undefined;
        const isHidden = spellId === undefined || issecretvalue(spellId);
        this.bus.emit("player.spell-cast", { spellId: isHidden ? this.spells.resolveFromName(spellName) : spellId, spellName });
    }
}
