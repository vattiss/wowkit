// Putting the addon together, the stage of the proc rules (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Texts } from "./addon";
import type { Game } from "./game-services";
import { ProcRulesService } from "./glows/proc-rules.service";
import type { StanceProcsService } from "./glows/stance-procs.service";

/** The engine of the proc rules (beta), and the looks of their groups' rows while it is on. */
export function makeProcRules(addon: Addon, game: Game, texts: Texts, stanceProcs: StanceProcsService): ProcRulesService {
    const { spells, player, units, spellDetails, cooldownViewer, auras } = game;
    const procRules = addon.register(
        new ProcRulesService(texts.settings, spells, player, units, spellDetails, stanceProcs, cooldownViewer, auras),
    );
    texts.styles.useProcGroups((spellId) => (procRules.isOn() ? procRules.findLitGroup(spellId) : undefined));
    return procRules;
}
