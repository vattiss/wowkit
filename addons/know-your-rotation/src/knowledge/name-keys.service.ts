// Spells are matched by name as well as by ID: Forever remaps IDs, and the client often hides an aura's ID but shows its
// name. A name key is the name in the client's language, lower case, without "(Rank 2)" and the like; sets of them are
// built from spell IDs the first time they are asked for, so they hold in any client language.
import { OnEvent } from "@wowkit/core";
import { type SpellsService, buildNameKey } from "@wowkit/wow";

export class NameKeysService {
    private readonly sets = new LuaMap<string, LuaSet<string>>();

    constructor(private readonly spells: SpellsService) {}

    /** New spells, new names: the sets are built again when next asked for. */
    @OnEvent("spells.invalidated")
    forgetNameSets(): void {
        for (const [key] of this.sets) this.sets.delete(key);
    }

    /** The name key of a spell; undefined when the client does not name it. */
    findKeyOf(spellId: number | undefined): string | undefined {
        const name = this.spells.getSpellName(spellId);
        return name !== undefined && name !== "" ? buildNameKey(name) : undefined;
    }

    /** Is the name one of these spells' names? `setName` names the set for the cache. */
    isNameOf(name: string | undefined, setName: string, ids: number[]): boolean {
        if (name === undefined || name === "") return false;
        return this.getNameSet(setName, ids).has(buildNameKey(name));
    }

    /** Is the spell (by ID or by name) one of these? */
    isOneOf(spellId: number | undefined, setName: string, ids: number[]): boolean {
        if (spellId === undefined) return false;
        if (ids.includes(spellId)) return true;
        return this.isNameOf(this.spells.getSpellName(spellId), setName, ids);
    }

    private getNameSet(setName: string, ids: number[]): LuaSet<string> {
        const cached = this.sets.get(setName);
        if (cached) return cached;
        const keys = new LuaSet<string>();
        for (const id of ids) {
            const key = this.findKeyOf(id);
            if (key !== undefined) keys.add(key);
        }
        // Names not loaded yet: try again next time
        if (!keys.isEmpty()) this.sets.set(setName, keys);
        return keys;
    }
}
