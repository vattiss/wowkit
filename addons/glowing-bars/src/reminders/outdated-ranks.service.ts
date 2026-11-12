// The rule of the old ranks: a spell on the action bars at a lower rank than the highest one the player has learned. A macro
// casts the highest rank, or the one it names on purpose, so a spell in a macro never counts. Only a button the player can
// see counts, on a bar that glows: a rank 1 on a hidden bar would only bring a message with nothing to look at. Reading every spell on the bars
// is the costliest part of a tick and its answer changes only with the bars or the spells, so it is kept until then.
import { OnEvent } from "@wowkit/core";
import type { ActionBarsService, BarKeysService, SpellsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";

export interface OutdatedRank {
    id: number;
    name: string;
    /** The rank on the bar. */
    onBar: number;
    /** The highest learned rank. */
    best: number;
}

/** A spell name on the bars, outside macros: every rank of it there, and the highest the player has learned. */
interface RanksOnBars {
    name: string;
    best: number;
    onBars: { id: number; rank: number }[];
}

export class OutdatedRanksService {
    /** The names with a rank on the bars below the best, sorted; undefined when they have to be looked for again. */
    private found: RanksOnBars[] | undefined;

    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly spells: SpellsService,
        private readonly settings: AddonSettingsService,
        private readonly barKeys: BarKeysService,
    ) {}

    /** The bars or the spells changed: the next look reads them again. */
    @OnEvent("bars.mapped", "spells.refreshed", "spells.invalidated", "spellbook.indexed")
    forgetFound(): void {
        this.found = undefined;
    }

    /**
     * Every spell whose highest rank on a button the player can see, on a bar that glows, is below the highest learned one,
     * sorted by name. A bar shown or hidden counts at once, so the buttons are asked every time.
     */
    findOutdatedRanks(): OutdatedRank[] {
        this.found ??= this.readRanksOnBars();
        const outdated: OutdatedRank[] = [];
        if (this.found.length === 0) return outdated;
        const enabledRanks = this.settings.get("enabledRanks");
        for (const entry of this.found) {
            if (enabledRanks[entry.name] === false) continue;
            let shown: { id: number; rank: number } | undefined;
            for (const onBar of entry.onBars) if (onBar.rank > (shown?.rank ?? -1) && this.isOnGlowingButton(onBar.id)) shown = onBar;
            if (shown !== undefined && shown.rank < entry.best)
                outdated.push({ id: shown.id, name: entry.name, onBar: shown.rank, best: entry.best });
        }
        return outdated;
    }

    /** Is the spell on a button the player can see, on a bar that glows (a button of no numbered bar always may)? */
    private isOnGlowingButton(spellId: number): boolean {
        const barsThatGlow = this.settings.get("barsThatGlow");
        return this.actionBars.listShownButtonsWith(spellId).some((button) => {
            const bar = this.barKeys.getBarKey(button);
            return bar === undefined || barsThatGlow[bar] !== false;
        });
    }

    /** The names on the bars, outside macros, with a rank there below the highest learned one. */
    private readRanksOnBars(): RanksOnBars[] {
        const byName = new LuaMap<string, { id: number; rank: number }[]>();
        for (const id of this.actionBars.listSpellIdsOnBars()) {
            const name = this.spells.getSpellName(id);
            const rank = name !== undefined && name !== "" ? this.spells.getSpellRank(id) : undefined;
            if (name === undefined || rank === undefined || this.actionBars.isInMacro(name)) continue;
            const list = byName.get(name) ?? [];
            list.push({ id, rank });
            byName.set(name, list);
        }
        const found: RanksOnBars[] = [];
        for (const [name, onBars] of byName) {
            const best = this.spells.getHighestRank(onBars[0]!.id);
            if (best !== undefined && onBars.some((onBar) => onBar.rank < best)) found.push({ name, best, onBars });
        }
        found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return found;
    }
}
