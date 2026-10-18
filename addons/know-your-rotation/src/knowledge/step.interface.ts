// A step of a list: a spell, and the conditions under which it is offered. The conditions are checked in the order of
// steps/step-checks.ts; a missing condition is not checked.

/** A creature type list: true is Mechanical and Elemental (immune to stings and bleeds), or named types. */
export type CreatureList = true | string[];

export interface StepOptions {
    /** Only for this role. */
    role?: string;
    /** An attack: needs a living enemy target, and is range-checked against it. */
    isAttack?: boolean;
    /** A heal: offered by health, landing on the unit a press would heal. */
    isHeal?: boolean;
    /** Health percent at or below which it is offered (the player's, `unit`'s, or the healed unit's). */
    hp?: number;
    /** The unit `hp` (and the auras of a heal) are read on: "target", "pet", "player". */
    unit?: UnitToken;
    /** Kept up on the player (a seal, Slice and Dice, a HoT on the healed unit): offered while it is missing. */
    isKeptUp?: boolean;
    /** Kept up on the target: true for the spell's own debuff, a spell ID for another one. Offered while it is missing. */
    keepsDebuff?: true | number;
    /** Seconds left under which a kept-up buff or debuff is offered again. Debuffs: 6 by default; buffs: never. */
    refresh?: number;
    /** With a kept-up aura: offered until it has this many stacks (Sunder Armor, Lacerate). */
    stacks?: number;
    /** No effect on these creature types. */
    noCreature?: CreatureList;
    /** Only on these creature types (Exorcism: Undead, Demon). An unknown type lets it through. */
    creature?: CreatureList;
    /** A totem: offered while it is not standing (`refresh`: seconds left under which it counts as gone). */
    isTotem?: boolean;
    /** Needs this many enemies around (within `enemiesYards`). */
    enemiesMin?: number;
    enemiesYards?: number;
    /** Not on a target that is almost dead (below 20%, below 5% for an elite). */
    shouldSkipDying?: boolean;
    /** Only on a target that has mana (Viper Sting). */
    isForManaUsers?: boolean;
    /** Needs one of these buffs on the player (Judgement after a seal). */
    needAnyBuff?: number[];
    /** Only while the target attacks the player (Aspect of the Monkey). */
    isWhenAttacked?: boolean;
    /** Not while any of these buffs is on the player (one seal, one aura, one aspect). */
    anyBuff?: number[];
    /** Only in this form. */
    form?: number;
    /** Not in this form. */
    noForm?: number;
    isCombatOnly?: boolean;
    isOutOfCombatOnly?: boolean;
    /** Needs this many combo points. */
    comboMin?: number;
    isWithPet?: boolean;
    isWithoutPet?: boolean;
    /** Only for a hunter who has tamed a pet (Call Pet is learned before any pet is). */
    isWithTamedPet?: boolean;
    /** No checks of readiness or usability. */
    isAlwaysReady?: boolean;
    /** Spammed (Wrath, Heroic Strike): no hold, and it yields to a ready action later in the list. */
    isFiller?: boolean;
    /** An auto-repeat attack (Auto Shot, Shoot): offered only while it is not running. */
    isAutoRepeat?: boolean;
    /** First at a pull: before the offensive racials and the cast-time opener (Hunter's Mark reaches farther than both). */
    isPullFirst?: boolean;
    /** Only in combat or with an enemy targeted (seals, Tiger's Fury). */
    isFightOnly?: boolean;
    /** Needs an attackable target, without a range check (Stealth before a pull). */
    isWithEnemyTarget?: boolean;
    /** At least one of these spells is learned (Stealth needs an opener). */
    needKnownAny?: number[];
    /** The target is at most this many yards away (a racial has no range of its own). */
    reach?: number;
    /** Only on a target below the player's level. */
    isForWeakTarget?: boolean;
    maxLevel?: number;
    minLevel?: number;
    /** Only from behind the target (Backstab, Shred). */
    isFromBehind?: boolean;
    /** Not in melee range; a spell ID: only once that spell is learned (melee shaman: Stormstrike). */
    notInMelee?: true | number;
    /** Only in melee range (Frost Nova). */
    isInMeleeOnly?: boolean;
    /** Not once this other spell is learned (Summon Imp until Summon Voidwalker). */
    notKnown?: number;
    /** Not when the talent tree with the most points has this word in its name. */
    notTree?: string;
    isSwimmingOnly?: boolean;
    /** Only in a group (threat drops); with `isAlsoWithPet` a pet counts too. */
    isGroupOnly?: boolean;
    isAlsoWithPet?: boolean;
    isPetDeadOnly?: boolean;
    isPetAliveOnly?: boolean;
    /** Target health percent per combo point under which a finisher is offered (Eviscerate). */
    hpPerCombo?: number;
    /** Needs this buff on the player (Garrote and Ambush need Stealth). */
    needBuff?: number;
    /** Needs this debuff on the target (Conflagrate needs Immolate). */
    needDebuff?: number;
    /** Only while the client says it is usable after a dodge, a parry or a proc. */
    proc?: true | string;
    /** Only while the client says it is usable. */
    isUsableOnly?: boolean;
    /** Only while the player's mana percent is at or below this. */
    manaMax?: number;
    /** Not while health (the player's or `unit`'s) is below this percent. */
    hpMin?: number;
    /** Seconds after a cast during which it is not offered again (a DoT, a HoT, a snare). */
    hold?: number;
    /** Not while any of these debuffs is on the target (one sting, one curse). */
    anyDebuff?: number[];
    /** The health is hidden: the threshold is shown another way (a glow faded by the client). */
    isHealthUnchecked?: boolean;
    /** The mana is hidden: the threshold is shown another way. */
    isManaUnchecked?: boolean;
}

export interface Step {
    /** Unique in its list. */
    key: string;
    id: number;
    opt: StepOptions;
    /** Off by default steps stay in the list, but are never offered. */
    isOn: boolean;
    isRacial?: boolean;
    /** An offensive racial: first in the list, before the pull opener. */
    isFront?: boolean;
}

/** A step of a default list; off with `isOn` false. */
export function createStep(key: string, id: number, opt: StepOptions = {}, isOn = true): Step {
    return { key, id, opt, isOn };
}
