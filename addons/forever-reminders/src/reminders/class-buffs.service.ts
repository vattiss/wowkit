// The buff list of the player's class and the per-character switch of each buff.

import type { SettingsService } from "../settings/settings.service";
import type { PlayerService, SpellsService } from "@forever/wow";
import type { ClassBuff } from "./class-buff.interface";
import { BUFF_LISTS } from "./class-buffs.constants";

export class ClassBuffsService {
    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly settings: SettingsService,
    ) {}

    /** The buffs of the player's class, in list order. */
    getClassBuffs(): ClassBuff[] {
        const token = this.player.getClassToken();
        return (token !== undefined ? BUFF_LISTS[token] : undefined) ?? [];
    }

    /**
     * How long a buff that was seen or cast counts as up while the client hides the auras: the `last`
     * of its list entry (matched by ID or name), else 30 seconds.
     */
    getBuffSeconds(spellId: number | undefined, name: string): number {
        for (const classBuff of this.getClassBuffs()) {
            if (classBuff.last !== undefined && (classBuff.id === spellId || this.spells.getSpellName(classBuff.id) === name)) {
                return classBuff.last;
            }
        }
        return 30;
    }

    isBuffEnabled(classBuff: ClassBuff): boolean {
        return this.settings.get("buffOn")[classBuff.key] ?? classBuff.isOnByDefault;
    }

    /** Switches one buff on or off; the default is not stored. */
    setBuffEnabled(classBuff: ClassBuff, isOn: boolean): void {
        const buffOn = { ...this.settings.get("buffOn") };
        buffOn[classBuff.key] = isOn === classBuff.isOnByDefault ? undefined : isOn;
        this.settings.change("buffOn", buffOn);
    }
}
