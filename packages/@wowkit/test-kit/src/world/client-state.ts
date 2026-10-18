// What the fake game currently is: the character, its spells and action bars, the auras on it, the
// party, the bags. A test fills in the parts it needs; the install-*.ts files answer the game's API
// from this state, so changing it in the middle of a test changes what the addon sees.

export interface CharacterClass {
    name: string;
    token: string;
    id: number;
}

export interface SpellDefinition {
    id: number;
    name: string;
    rank: number;
    icon: number;
}

/** A buff on a character. `expirationTime` is on the game's clock (see World.makeAura). */
export interface FakeAura {
    name: string;
    spellId: number;
    expirationTime: number;
    sourceUnit?: string;
}

export interface FakePartyMember {
    name: string;
    classToken: string;
    power: number;
    auras: FakeAura[];
    isDead?: boolean;
    isOutOfRange?: boolean;
}

export interface FakeEnchant {
    enchantID: number;
    remainingTimeMs: number;
}

/** The numbers the game uses for the kinds of power. */
export const POWER = { Mana: 0, Rage: 1, Energy: 3 };

export interface ClientState {
    character: CharacterClass;
    /** Every spell that exists in the test, learned or not. */
    spells: { [spellId: number]: SpellDefinition | undefined };
    knownSpells: { [spellId: number]: true | undefined };
    /** Action slot (1-12 for the main bar) -> the spell on it. */
    bars: { [slot: number]: number | undefined };
    /** The buffs on the player, in the order the game lists them. */
    auras: FakeAura[];
    isInCombat: boolean;
    /** In combat the game hides the auras: the list comes back empty. */
    areAurasHidden: boolean;
    isResting: boolean;
    /** Inventory slot (16 main hand, 17 off hand) -> the temporary enchant on it. */
    enchants: { [slot: number]: FakeEnchant | undefined };
    /** The client gives no answer about weapon enchants (reads fail), as it sometimes does. */
    areEnchantReadsBroken: boolean;
    equippedItems: { [slot: number]: number | undefined };
    /** Spells that cannot be cast right now (no rage, no mana). */
    unusableSpells: { [spellId: number]: true | undefined };
    /** party1, party2... in this order. */
    party: FakePartyMember[];
    isInRaid: boolean;
    bags: { [itemId: number]: number | undefined };
    /** The reagent named in a spell's tooltip. */
    reagentTexts: { [spellId: number]: string | undefined };
}

export function createClientState(): ClientState {
    return {
        character: { name: "Priest", token: "PRIEST", id: 5 },
        spells: {},
        knownSpells: {},
        bars: {},
        auras: [],
        isInCombat: false,
        areAurasHidden: false,
        isResting: false,
        enchants: {},
        areEnchantReadsBroken: false,
        equippedItems: {},
        unusableSpells: {},
        party: [],
        isInRaid: false,
        bags: {},
        reagentTexts: {},
    };
}

export function playAs(state: ClientState, character: CharacterClass): void {
    state.character = character;
}

/** The spell exists and the character has learned it. */
export function learnSpell(state: ClientState, spell: SpellDefinition): void {
    state.spells[spell.id] = spell;
    state.knownSpells[spell.id] = true;
}
