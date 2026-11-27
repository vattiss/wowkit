// What the specs of the table of looks share: a warrior with Recklessness, and the way to the table and its rows.
import { learnSpell, playAs, WARRIOR, type ClientState, type FakeFrame, type SpellDefinition, type World } from "@wowkit/test-kit";

export const RECKLESSNESS: SpellDefinition = {
    id: 1719,
    name: "Recklessness",
    // One rank: no rank in its subtext, so no Old ranks row
    rank: 0,
    icon: 132109,
    cooldownSeconds: 300,
    isHelpful: true,
};

/** Recklessness is used in the fight and comes back: the moment it glows in combat. */
export function useAndRecoverRecklessness(world: World): void {
    world.state.cooldowns[RECKLESSNESS.id] = { start: 0, duration: 99999 };
    world.advance(0.5);
    world.state.cooldowns[RECKLESSNESS.id] = undefined;
    world.advance(0.5);
}

export function setUpWarrior(state: ClientState): void {
    playAs(state, WARRIOR);
    learnSpell(state, RECKLESSNESS);
    state.bars[2] = RECKLESSNESS.id;
    state.isInCombat = true;
}

/** The widgets of the row with this label in the open table. */
export interface Row {
    swatch: FakeFrame;
    glowPercent: FakeFrame;
    message: FakeFrame;
    enabled: FakeFrame;
    sound: FakeFrame;
    reset: FakeFrame;
}

/** Is the frame on the screen: shown, and every frame it is in too? A row of another tab is hidden, and keeps its old words. */
function isOnScreen(frame: FakeFrame | undefined): boolean {
    for (let each = frame; each !== undefined; each = each.parent) if (!each.isShown) return false;
    return true;
}

/** The tabs of the table that have rows, in their order (Proc rules has its own headings, not rows: its specs open it). */
const TABS = ["Buffs", "Debuffs", "Cooldowns", "Procs", "Consumables", "Old ranks", "Sounds"];

/**
 * The text with this label in the open table: on the tab shown, else on the first other tab that has it, which is then
 * shown. Undefined when no tab has it.
 */
export function findLabel(world: World, label: string): FakeFrame | undefined {
    const found = findShownLabel(world, label);
    if (found !== undefined) return found;
    for (const tab of TABS) {
        const button = world.frames.find((frame) => frame.frameType === "Button" && frame.text === tab && isOnScreen(frame));
        if (button === undefined) continue;
        button.scripts.OnClick!(button);
        const onTab = findShownLabel(world, label);
        if (onTab !== undefined) return onTab;
    }
    return undefined;
}

/** The text with this label on the tab shown, without looking at the other tabs. */
export function findLabelOnTab(world: World, label: string): FakeFrame | undefined {
    return findShownLabel(world, label);
}

/** The text with this label on the screen: the text widgets are not frames of their own, they belong to the frame that made them. */
function findShownLabel(world: World, label: string): FakeFrame | undefined {
    // The rows first: a type's small heading in the list of spells says the same as its row
    const isRow = (frame: FakeFrame) => world.frames.some((other) => other.parent === frame && other.frameType === "CheckButton");
    const shown = world.frames.filter((frame) => isOnScreen(frame));
    for (const frame of [...shown.filter((frame) => isRow(frame)), ...shown]) {
        const found = frame.fontStrings.find((text) => text.text === label);
        if (found !== undefined) return found;
    }
    return undefined;
}

export function findRow(world: World, label: string): Row {
    const row = findLabel(world, label)?.parent;
    if (row === undefined) throw new Error(`no row for ${label}`);
    const parts = world.frames.filter((frame) => frame.parent === row);
    const buttons = parts.filter((frame) => frame.frameType === "Button" && frame.template === "UIPanelButtonTemplate");
    return {
        swatch: parts.find((frame) => frame.frameType === "Button" && frame.template === undefined)!,
        glowPercent: parts.find((frame) => frame.frameType === "EditBox")!,
        message: parts.filter((frame) => frame.frameType === "CheckButton")[0]!,
        enabled: parts.filter((frame) => frame.frameType === "CheckButton")[1]!,
        sound: buttons[0]!,
        reset: buttons[1]!,
    };
}

/** Shows the open table's tab with these words (Buffs, Cooldowns, Procs, Consumables, Old ranks, Sounds). */
export function showTab(world: World, label: string): void {
    const tab = world.frames.find((frame) => frame.frameType === "Button" && frame.text === label && isOnScreen(frame));
    if (tab === undefined) throw new Error(`no tab ${label}`);
    tab.scripts.OnClick!(tab);
}

export function toggleTable(): void {
    // The warrior of these tests is in a fight for his cooldowns, and in a fight the table does not open: opened as at peace
    const globals = _G as unknown as { InCombatLockdown: (this: void) => boolean };
    const isInLockdown = globals.InCombatLockdown;
    globals.InCombatLockdown = () => false;
    SlashCmdList["GLOWINGBARS"]!("", undefined as never);
    globals.InCombatLockdown = isInLockdown;
}

export function readSaved(world: World, section: "styles" | "spellStyles"): Record<string, Record<string, unknown> | undefined> {
    return world.getSavedSettings()?.[section] as Record<string, Record<string, unknown> | undefined>;
}

/** Switches a type or a spell on or off in the Enabled column of the table, the way a click does (the table is opened). */
/** Lists the spells not learned yet on this tab of the open table too (its Show unlearned spells switch, ticked). */
export function showUnlearned(world: World, tab: string): void {
    showTab(world, tab);
    const box = world.frames.find(
        (frame) =>
            frame.frameType === "CheckButton" &&
            isOnScreen(frame) &&
            frame.fontStrings.some((text) => text.text === "Show unlearned spells"),
    );
    if (box === undefined) throw new Error(`no Show unlearned spells on ${tab}`);
    box.isChecked = true;
    box.scripts.OnClick!(box);
}

export function switchInTable(world: World, label: string, isOn: boolean): void {
    const window = world.findFrame((frame) => frame.name === "GlowingBarsLooks");
    if (window?.isShown !== true) toggleTable();
    const row = findLabel(world, label)?.parent;
    if (row === undefined) throw new Error(`no row for ${label}`);
    const enabled = world.frames.filter((frame) => frame.parent === row && frame.frameType === "CheckButton")[1]!;
    enabled.isChecked = isOn;
    enabled.scripts.OnClick!(enabled);
}

/** The widgets of the row at the end of the table that adds a spell. */
/** The row that adds a spell, on this tab of the open table (shown first): Cooldowns unless said. */
export function findAddRowOf(world: World, tab = "Cooldowns"): { box: FakeFrame; reminderType: FakeFrame; add: FakeFrame } {
    showTab(world, tab);
    const box = world.frames.find(
        (frame) =>
            frame.frameType === "EditBox" &&
            !world.frames.some((other) => other.parent === frame.parent && other.frameType === "CheckButton"),
    )!;
    const buttons = world.frames.filter((frame) => frame.parent === box.parent && frame.template === "UIPanelButtonTemplate");
    return { box, reminderType: buttons[0]!, add: buttons[1]! };
}
