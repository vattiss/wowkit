// What the tests of buffs the game keeps secret share (issue #88): a player with a buff of their own added, or a class
// buff, whose aura the game may hide; putting it on, letting it run out, and walking into a dungeon.
import { createWorld, learnSpell, playAs, PRIEST, WARRIOR, type SpellDefinition, type World } from "@wowkit/test-kit";

export const WARD: SpellDefinition = { id: 1297774, name: "Magical Awareness", rank: 1, icon: 1, isHelpful: true };
export const OTHER_AURA = { name: "Other Aura", spellId: 99001, expirationTime: 1e9 };
export const FOOD_ITEM = 13935;
export const FOOD_SPELL = 18233;
export const WELL_FED = 19710;

/** A player with `buff` on button 1 (added, unless a class buff), its aura one the game may keep secret. */
export function createPlayer(buff: SpellDefinition, options: { isWarrior?: boolean; saved?: Record<string, unknown> } = {}): World {
    const world = createWorld(
        (state) => {
            playAs(state, options.isWarrior === true ? WARRIOR : PRIEST);
            learnSpell(state, buff);
            state.bars[1] = buff.id;
            state.auraSecrecy.hiddenSpells[buff.id] = true;
            state.auraSecrecy.hiddenSpells[WELL_FED] = true;
        },
        {
            addedSpells: options.isWarrior === true ? [] : [{ id: buff.id, reminderType: "missingBuff" }],
            styles: { missingBuff: { when: "always", before: 0 } },
            ...options.saved,
        },
    );
    world.state.auras.push({ ...OTHER_AURA });
    world.advance(1);
    return world;
}

export function putOn(world: World, buff: SpellDefinition, seconds: number): void {
    world.state.auras = world.state.auras.filter((aura) => aura.spellId !== buff.id);
    world.state.auras.push(world.makeAura(buff.name, buff.id, seconds, "player"));
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", "cast", buff.id);
    world.advance(1);
}

/** Into a dungeon: the auras restricted, the buff's aura secret and left out of the list. */
export function enterDungeon(world: World): void {
    const secrecy = world.state.auraSecrecy;
    secrecy.isHiding = true;
    secrecy.saysRestricted = true;
    secrecy.saysSecretOthers = true;
    world.fire("PLAYER_ENTERING_WORLD");
    world.advance(1);
}

export function runOut(world: World, buff: SpellDefinition, seconds: number): void {
    world.advance(seconds);
    world.state.auras = world.state.auras.filter((aura) => aura.spellId !== buff.id);
    world.advance(1);
}
