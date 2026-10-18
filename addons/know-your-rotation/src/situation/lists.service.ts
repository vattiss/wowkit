// The lists in use: the default list of the class, its role (or form) and the combat mode, with the racials of the
// player's race: the offensive ones first (the start of a fight), the others last. Read a few times per tick, so the
// list is kept for a moment.
import type { CharacterService, ClockService } from "@wowkit/wow";
import { RACIALS, type RacialEntry } from "../knowledge/class-data.constants";
import { CLASS_LISTS } from "../knowledge/lists/class-lists.constants";
import type { RoleLists } from "../knowledge/lists/list.interface";
import type { Step } from "../knowledge/step.interface";
import type { RoleService } from "./role.service";

/** A list is reused for this long. */
const LIST_REUSE = 0.25;

export class ListsService {
    private rotation: { key: string; at: number; steps: Step[] } | undefined;
    private defense: { key: string; at: number; steps: Step[] } | undefined;

    constructor(
        private readonly role: RoleService,
        private readonly character: CharacterService,
        private readonly clock: ClockService,
    ) {}

    /** The rotation list now: the AoE list when the mode says so (falling back to the single target list). */
    getRotation(): Step[] {
        const token = this.role.getClassToken();
        const listKey = this.role.getListKey();
        const isAoe = this.role.isAoeMode();
        const key = `${token}:${listKey}:${isAoe ? "aoe" : "single"}`;
        const now = this.clock.getCurrentTime();
        if (this.rotation && this.rotation.key === key && now - this.rotation.at < LIST_REUSE) return this.rotation.steps;
        const lists = CLASS_LISTS[token];
        const list = (isAoe ? this.pickList(lists?.aoe, listKey) : undefined) ?? this.pickList(lists?.rotation, listKey) ?? [];
        const racials = this.listRacialSteps(false);
        const steps = [...racials.filter((step) => step.isFront), ...list, ...racials.filter((step) => !step.isFront)];
        this.rotation = { key, at: now, steps };
        return steps;
    }

    /** The defense list now: defensive cooldowns, and the defensive racials. */
    getDefense(): Step[] {
        const token = this.role.getClassToken();
        const listKey = this.role.getListKey();
        const key = `${token}:${listKey}`;
        const now = this.clock.getCurrentTime();
        if (this.defense && this.defense.key === key && now - this.defense.at < LIST_REUSE) return this.defense.steps;
        const steps = [...(this.pickList(CLASS_LISTS[token]?.defense, listKey) ?? []), ...this.listRacialSteps(true)];
        this.defense = { key, at: now, steps };
        return steps;
    }

    /** The role's list, or the class's main one. */
    private pickList(lists: RoleLists | undefined, listKey: string): Step[] | undefined {
        if (!lists) return undefined;
        return lists[listKey] ?? lists.damage ?? lists.caster ?? lists.range;
    }

    private listRacialSteps(isDefensiveOnly: boolean): Step[] {
        const race = this.character.getRaceId();
        const faction = this.character.getFaction();
        return RACIALS.filter((racial) => (!isDefensiveOnly || racial.isDefensive === true) && this.isRacialOf(racial, race, faction)).map(
            (racial) => ({
                key: `racial_${racial.key}`,
                id: racial.id,
                opt: racial.opt ?? {},
                isOn: racial.isOn === true,
                isRacial: true,
                isFront: racial.isFront,
            }),
        );
    }

    /** The race and faction gates are hard: a Human never gets Blood Fury. */
    private isRacialOf(racial: RacialEntry, race: number | undefined, faction: string | undefined): boolean {
        if (racial.factions && (faction === undefined || !racial.factions.includes(faction))) return false;
        return race !== undefined && racial.races.includes(race);
    }
}
