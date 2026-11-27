// Putting the addon together, the stage of the proc rules (see addon.ts): a file of its own, as addon.ts is full.
import type { Addon } from "@wowkit/core";
import type { CooldownViewerService } from "@wowkit/wow";
import type { Texts } from "./addon";
import type { Game } from "./game-services";
import { ProcRulesService } from "./glows/proc-rules.service";
import { HealthRulesService } from "./glows/health-rules.service";
import { StackRulesService } from "./glows/stack-rules.service";
import { LowHealthRowsService } from "./glows/low-health-rows.service";
import type { GlowCuesService } from "./glows/glow-cues.service";
import { ProcRulesEditsService } from "./glows/proc-rules-edits.service";
import type { StanceProcsService } from "./glows/stance-procs.service";
import type { BuffStateService } from "./character/buff-state.service";
import { ProcRulesAddRow } from "./options/proc-rules-add-row";
import { ProcRulesTab } from "./options/proc-rules-tab";
import { ProcRuleRows } from "./options/proc-rule-rows";
import type { StyleWindowService } from "./options/style-window.service";
import type { BetaTabs } from "./options/style-table.service";
import { DebuffsSwitch } from "./options/debuffs-switch";

/** The engine of the proc rules (beta), the looks of their groups' rows while it is on, and the changes of the table. */
export function makeProcRules(
    addon: Addon,
    game: Game,
    texts: Texts,
    stanceProcs: StanceProcsService,
    buffState: BuffStateService,
): { procRules: ProcRulesService; procEdits: ProcRulesEditsService } {
    const { spells, player, units, spellDetails, cooldownViewer, auras } = game;
    const procRules = addon.register(
        new ProcRulesService(texts.settings, spells, player, units, spellDetails, stanceProcs, cooldownViewer, auras, buffState),
    );
    texts.styles.useProcGroups((spellId) => (procRules.isOn() ? procRules.findLitGroup(spellId) : undefined));
    const procEdits = addon.register(new ProcRulesEditsService(texts.settings, player));
    return { procRules, procEdits };
}

/** The tabs of the beta features: the Proc rules tab, with the row that adds a rule, and the switch over the Debuffs tab. */
export function makeProcRulesTab(game: Game, texts: Texts, procEdits: ProcRulesEditsService, windows: StyleWindowService): BetaTabs {
    const { locale, settings, messages } = texts;
    const addRow = new ProcRulesAddRow(locale, game.spells, procEdits, messages, game.cooldownViewer, settings);
    const rows = new ProcRuleRows(locale, game.spells, settings, procEdits, game.cooldownViewer);
    const procRules = new ProcRulesTab(locale, game.spells, settings, procEdits, windows, addRow, rows);
    return { procRules, debuffs: new DebuffsSwitch(locale, settings) };
}

/**
 * The player's rules on the health: lit faded by the game, as Templar's Bulwark; the rules on a buff's stacks, let through by
 * the game in a fight; the parts of the glows of the low health.
 */
export function makeHealthRules(
    addon: Addon,
    procRules: ProcRulesService,
    glowCues: GlowCuesService,
    glowParts: Readonly<ConstructorParameters<typeof HealthRulesService> extends [unknown, unknown, ...infer Rest] ? Rest : never>,
    viewer: CooldownViewerService,
): void {
    addon.register(new HealthRulesService(procRules, glowCues, ...glowParts));
    const [player, spells, actionBars, glow, , , styles, settings, , idle, barKeys] = glowParts;
    addon.register(new StackRulesService(procRules, glowCues, player, spells, actionBars, glow, viewer, styles, settings, idle, barKeys));
    // The look and switch of a defensive at low health, moved to its own row once
    addon.register(new LowHealthRowsService(settings, styles));
}
