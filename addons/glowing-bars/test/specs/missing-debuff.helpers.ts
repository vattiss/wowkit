// A hunter with Serpent Sting and Hunter's Mark, in a fight whose target's debuffs the game hides (unless said), and the
// casts and target changes of the debuff specs.
import { HUNTER, learnSpell, playAs, targetEnemy, createWorld, type ClientState, type SpellDefinition, type World } from "@wowkit/test-kit";

export const SERPENT_STING: SpellDefinition = { id: 1978, name: "Serpent Sting", rank: 1, icon: 132204, isHarmful: true, maxRange: 35 };
export const HUNTERS_MARK: SpellDefinition = { id: 1130, name: "Hunter's Mark", rank: 1, icon: 132212, isHarmful: true, maxRange: 100 };
export const ADDED = [
    { id: SERPENT_STING.id, reminderType: "missingDebuff" },
    { id: HUNTERS_MARK.id, reminderType: "missingDebuff" },
];

/** The game of a fight on Forever: the target's debuffs are kept from addon code, and C_Secrets says so. */
export function hideDebuffs(state: ClientState): void {
    const secrecy = state.auraSecrecy;
    secrecy.isHiding = true;
    secrecy.hidesDebuffs = true;
    secrecy.hiddenSpells[SERPENT_STING.id] = true;
    secrecy.hiddenSpells[HUNTERS_MARK.id] = true;
    secrecy.saysRestricted = true;
    secrecy.saysSecretOthers = true;
}

/** A hunter with Serpent Sting on button 1 and Hunter's Mark on button 2, both added; in a fight with an enemy whose debuffs are hidden, unless said. */
export function createHunter(saved: Record<string, unknown> = {}, isHidden = true): World {
    const world = createWorld(
        (state) => {
            playAs(state, HUNTER);
            learnSpell(state, SERPENT_STING);
            learnSpell(state, HUNTERS_MARK);
            state.bars[1] = SERPENT_STING.id;
            state.bars[2] = HUNTERS_MARK.id;
            state.isInCombat = true;
            if (isHidden) hideDebuffs(state);
            targetEnemy(state);
        },
        { addedSpells: ADDED, shouldUseDebuffs: true, ...saved },
    );
    world.advance(1);
    return world;
}

export function cast(world: World, spell: SpellDefinition): void {
    world.fire("UNIT_SPELLCAST_SUCCEEDED", "player", `cast-${spell.id}`, spell.id);
    world.advance(0.5);
}

export function changeTarget(world: World, name: string): void {
    targetEnemy(world.state, { name });
    world.fire("PLAYER_TARGET_CHANGED");
    world.advance(0.5);
}
