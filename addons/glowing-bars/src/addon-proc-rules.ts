// Putting the addon together, the stage of the proc rules (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { Texts } from "./addon";
import type { Game } from "./game-services";
import { ProcRulesService } from "./glows/proc-rules.service";
import { ProcRulesEditsService } from "./glows/proc-rules-edits.service";
import type { StanceProcsService } from "./glows/stance-procs.service";
import { ProcRulesAddRow } from "./options/proc-rules-add-row";
import { ProcRulesTab } from "./options/proc-rules-tab";
import type { StyleWindowService } from "./options/style-window.service";

/** The engine of the proc rules (beta), the looks of their groups' rows while it is on, and the changes of the table. */
export function makeProcRules(
    addon: Addon,
    game: Game,
    texts: Texts,
    stanceProcs: StanceProcsService,
): { procRules: ProcRulesService; procEdits: ProcRulesEditsService } {
    const { spells, player, units, spellDetails, cooldownViewer, auras } = game;
    const procRules = addon.register(
        new ProcRulesService(texts.settings, spells, player, units, spellDetails, stanceProcs, cooldownViewer, auras),
    );
    texts.styles.useProcGroups((spellId) => (procRules.isOn() ? procRules.findLitGroup(spellId) : undefined));
    const procEdits = addon.register(new ProcRulesEditsService(texts.settings, player));
    return { procRules, procEdits };
}

/** The Proc rules tab of the table, with the row that adds a rule. */
export function makeProcRulesTab(game: Game, texts: Texts, procEdits: ProcRulesEditsService, windows: StyleWindowService): ProcRulesTab {
    const addRow = new ProcRulesAddRow(texts.locale, game.spells, procEdits, texts.messages);
    return new ProcRulesTab(texts.locale, game.spells, texts.settings, procEdits, windows, addRow);
}
