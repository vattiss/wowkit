// Whether the client may keep a spell's aura from addon code: in a dungeon, a raid or a fight it restricts the auras, and
// keeps some spells' secret; such an aura reads as if it were not there. What C_Secrets says is all there is to go by, and
// it may refuse to answer or answer with a secret: only a plain "no" counts as one. Also counted: the moments the client
// may start or stop hiding (a fight starting or ending, a zone, a change in what C_Secrets says), so what was seen since
// the last of them is known to be visible.
import { OnGameEvent } from "@wowkit/core";
import { tryCall } from "./utils/protected-call.utils";
import { isReadable } from "./utils/secret-value.utils";
import type { SpellsService } from "./spells.service";

/** An answer of C_Secrets: a plain yes or no, a secret value, a failed call, or no such call in this client. */
export type SecrecyAnswer = "yes" | "no" | "secret" | "error" | "missing";

/** A call's result as an answer: only a readable true or false is a plain one. */
function convertAnswer(didSucceed: boolean, value: unknown): SecrecyAnswer {
    if (!didSucceed) return "error";
    if (!isReadable(value)) return "secret";
    return value === true ? "yes" : "no";
}

export class AuraSecrecyService {
    /** Goes up at each moment the client may start or stop hiding auras. */
    private phase = 0;
    /** What ShouldAurasBeSecret said at the last look, and when that was. */
    private restrictedSays: SecrecyAnswer | undefined;
    private restrictedAt: number | undefined;

    constructor(private readonly spells: SpellsService) {}

    /** What C_Secrets says of the auras in general: are they restricted now? */
    readRestricted(): SecrecyAnswer {
        const now = GetTime();
        if (this.restrictedAt === now && this.restrictedSays !== undefined) return this.restrictedSays;
        const says = this.readRestrictedCall();
        // Reading the player's first buff fails while they are restricted, whatever C_Secrets says
        const [didRead] = tryCall(C_UnitAuras.GetAuraDataByIndex, "player", 1, "HELPFUL");
        const answer: SecrecyAnswer = didRead ? says : "error";
        if (this.restrictedSays !== undefined && answer !== this.restrictedSays) this.phase += 1;
        this.restrictedSays = answer;
        this.restrictedAt = now;
        return answer;
    }

    /** C_Secrets.ShouldAurasBeSecret's answer alone. */
    private readRestrictedCall(): SecrecyAnswer {
        const call = C_Secrets?.ShouldAurasBeSecret;
        if (call === undefined) return "missing";
        const [didSay, isSaid] = tryCall(call);
        return convertAnswer(didSay, isSaid);
    }

    /** What C_Secrets says of one spell's aura: would it be secret? */
    readSpellSecrecy(spellId: number): SecrecyAnswer {
        const call = C_Secrets?.ShouldSpellAuraBeSecret;
        if (call === undefined) return "missing";
        const [didSay, isSaid] = tryCall(call, this.spells.resolve(spellId) ?? spellId);
        return convertAnswer(didSay, isSaid);
    }

    /**
     * May the client keep this spell's aura from addon code now? The auras are restricted (not a plain no), and the spell's
     * aura is not said plainly not to be secret. A client without the call has no secret auras.
     */
    isAuraSecret(spellId: number): boolean {
        const restricted = this.readRestricted();
        if (restricted === "no" || restricted === "missing") return false;
        const spell = this.readSpellSecrecy(spellId);
        return spell !== "no" && spell !== "missing";
    }

    /** The moment count: an aura seen since it last went up is one the client shows. */
    getSecrecyPhase(): number {
        this.readRestricted();
        return this.phase;
    }

    @OnGameEvent("PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED", "PLAYER_ENTERING_WORLD", "ZONE_CHANGED_NEW_AREA")
    noteSecrecyMoment(): void {
        this.phase += 1;
    }
}
