// How the fake game hides auras from addon code, as the real one may in a dungeon, a raid or a fight: which spells' auras it
// hides, how a hidden aura shows (left out of the list, kept with secret fields, or the read fails), and what C_Secrets says
// of it all. What C_Secrets says is set on its own: it may be wrong, as a game changed tomorrow could be.
import { defineNamespace } from "./define";
import { SECRET_VALUE } from "./secret-value";

/** An answer of C_Secrets: yes, no, a secret value, or the call fails. */
export type SecretsAnswer = boolean | "secret" | "error";

export interface AuraSecrecy {
    /** The client hides the auras of `hiddenSpells` now (the truth, whatever C_Secrets says). */
    isHiding: boolean;
    /** The spells whose auras it hides while hiding. */
    hiddenSpells: { [spellId: number]: true | undefined };
    /** A hidden aura in GetAuraDataByIndex: left out, kept with its name, ID, time and caster secret, or the read fails. */
    inList: "omit" | "secretFields" | "error";
    /** A hidden aura asked for directly (GetPlayerAuraBySpellID, GetAuraDataBySpellName): no answer, secret fields, or the call fails. */
    direct: "nil" | "secretFields" | "error";
    /** C_Secrets.ShouldAurasBeSecret's answer; "missing": the client has no such call (read when the world is made, as is isSpellCallMissing). */
    saysRestricted: SecretsAnswer | "missing";
    /** C_Secrets.ShouldSpellAuraBeSecret's answer for a spell; `saysSecretOthers` for any spell not listed. */
    saysSecret: { [spellId: number]: SecretsAnswer | undefined };
    saysSecretOthers: SecretsAnswer;
    /** The client has no ShouldSpellAuraBeSecret. */
    isSpellCallMissing: boolean;
}

export function createAuraSecrecy(): AuraSecrecy {
    return {
        isHiding: false,
        hiddenSpells: {},
        inList: "omit",
        direct: "nil",
        saysRestricted: false,
        saysSecret: {},
        saysSecretOthers: false,
        isSpellCallMissing: false,
    };
}

/** Is this spell's aura hidden from addon code now? */
export function isAuraHidden(secrecy: AuraSecrecy, spellId: number): boolean {
    return secrecy.isHiding && secrecy.hiddenSpells[spellId] === true;
}

/** An answer of C_Secrets as the call gives it: a value, a secret value, or an error. */
function giveAnswer(answer: SecretsAnswer): boolean {
    if (answer === "error") error("C_Secrets refused");
    return answer === "secret" ? (SECRET_VALUE as unknown as boolean) : answer;
}

/** C_Secrets as the secrecy says; missing calls are left out. */
export function installSecrets(secrecy: AuraSecrecy): void {
    defineNamespace<typeof C_Secrets>("C_Secrets", {
        ShouldAurasBeSecret: (() =>
            secrecy.saysRestricted === "missing" ? false : giveAnswer(secrecy.saysRestricted)) as typeof C_Secrets.ShouldAurasBeSecret,
        ShouldSpellAuraBeSecret: ((spellId: number) =>
            giveAnswer(secrecy.saysSecret[spellId] ?? secrecy.saysSecretOthers)) as typeof C_Secrets.ShouldSpellAuraBeSecret,
    });
    const secrets = (_G as unknown as { C_Secrets: Record<string, unknown> }).C_Secrets;
    // A client without the calls: the namespace itself stays (as other calls of it are there)
    if (secrecy.saysRestricted === "missing") secrets.ShouldAurasBeSecret = undefined;
    if (secrecy.isSpellCallMissing) secrets.ShouldSpellAuraBeSecret = undefined;
}

/** A hidden aura's data as addon code gets it: its name, ID, time and caster are secret. */
export function hideAuraFields(data: AuraData): AuraData {
    const secret = SECRET_VALUE as unknown;
    return {
        ...data,
        name: secret as string,
        spellId: secret as number,
        expirationTime: secret as number,
        sourceUnit: secret as UnitToken,
    };
}
