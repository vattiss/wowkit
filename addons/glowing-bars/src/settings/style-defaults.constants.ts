// The looks of the reminders until the player changes them: of each type, and of the few spells that want another.
import { Paladin, Racial, Warrior } from "@wowkit/wow-data";
import { TOTEM_ELEMENTS } from "../reminders/totems.constants";
import type { ReminderType, Style, StyleOverride } from "./settings.interface";

/** The default looks of some spells, by type and spell ID: what they want unlike the rest of their type. */
/** The row of Execute in Defensive Stance in the table: no spell has this ID, so its look and its switch are its own. */
export const DEFENSIVE_EXECUTE_ROW = -Warrior.Execute;

export const SPELL_STYLE_DEFAULTS: { [key in ReminderType]?: { [spellId: number]: StyleOverride | undefined } } = {
    // Its row has a type of its own to tell apart from: "Proc" alone would say little
    // A last-resort defensive is no use out of a fight, eating or drinking at low health
    proc: { [DEFENSIVE_EXECUTE_ROW]: { messageTextChoice: "name" }, [Paladin.TemplarsBulwark]: { when: "inCombat" } },
    // Shield Block lasts 7 seconds: out of a fight it is no use
    missingBuff: { [Warrior.ShieldBlock]: { when: "inCombat" } },
    // Cultivation grows a second herb: it is used while gathering, out of a fight
    readyCooldown: { [Racial.Cultivation]: { when: "outOfCombat" } },
    // Each element in its colour: the glow itself tells which one went
    totemGone: Object.fromEntries(TOTEM_ELEMENTS.map((element) => [element.rowId, { color: element.color }])),
};

/** The look of each type of reminder until the player changes it. The old ranks and the low reagents are a quiet hint. */
export const STYLE_DEFAULTS: { [key in ReminderType]: Style } = {
    missingBuff: {
        color: [0.2, 0.55, 1],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
    weaponBuff: {
        color: [1, 0.55, 0.1],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
    // The paladin's gold
    missingSeal: {
        color: [1, 0.85, 0.2],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "inCombat",
        glowTime: 0,
        animation: "circling",
    },
    // #1AA6BF, a deep turquoise: a lighter cyan glows almost white
    missingTracking: {
        color: [0.1, 0.65, 0.75],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
    // A short note as a totem goes, wherever the player is; each element has a colour of its own (its row)
    totemGone: {
        color: [1, 0.75, 0.35],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 3,
        animation: "circling",
    },
    readyCooldown: {
        color: [1, 1, 1],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "inCombat",
        glowTime: 3,
        animation: "circling",
    },
    proc: {
        color: [1, 0.12, 0.08],
        glowPercent: 100,
        isMessageOn: false,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
    oldRank: {
        color: [1, 0.85, 0.2],
        glowPercent: 50,
        isMessageOn: true,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
    // Its message is the town's: it names the reagents to buy
    lowReagent: {
        color: [1, 0.85, 0.2],
        glowPercent: 50,
        isMessageOn: true,
        sound: "none",
        repeat: 0,
        when: "townAlert",
        glowTime: 0,
        animation: "circling",
    },
    // A quieter red than the procs'
    lowStock: {
        color: [1, 0.12, 0.08],
        glowPercent: 50,
        isMessageOn: true,
        sound: "none",
        repeat: 0,
        when: "always",
        glowTime: 0,
        animation: "circling",
    },
};
