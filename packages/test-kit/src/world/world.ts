// A fresh game with the addon loaded and logged in: what a test starts from. `setup` shapes the
// character before the addon sees it; afterwards the test plays through events and time.
import { config } from "../config";
import { createClock } from "./clock";
import { createClientState, type ClientState, type FakeAura } from "./client-state";
import { clearGlobal, readGlobal } from "./define";
import { createFrameRegistry, type FakeFrame } from "./frames";
import { installClock } from "./install-clock";
import { installActionBars, installAuras } from "./install-bars-and-auras";
import { installItems } from "./install-items";
import { installSpells } from "./install-spells";
import { installUi, type ProxySettings } from "./install-ui";
import { installUnits } from "./install-units";

export interface World {
    /** The character, its spells, bars, auras, party and bags; change it and the addon sees the change. */
    state: ClientState;
    /** The lines the addon printed to the chat window. */
    chat: string[];
    /** The sounds the addon played. */
    sounds: number[];
    /** The checkboxes and dropdowns the addon put in the Settings panel, by variable name. */
    proxySettings: ProxySettings;
    /** Sets a checkbox or dropdown of the options page, the way the player's click does: "showWeapon", "buff_InnerFire". */
    setOption(name: string, value: unknown): void;
    frames: FakeFrame[];
    /** A game event, delivered to every frame that listens for it. */
    fire(event: string, ...args: unknown[]): void;
    /** Moves time forward; timers and the addon's regular tick run on the way. */
    advance(seconds: number): void;
    /** A buff that lasts `secondsLeft` more seconds from now. */
    makeAura(name: string, spellId: number, secondsLeft: number, sourceUnit?: string): FakeAura;
    /** How many glows are showing on action button 1..12. */
    glowsOn(button: number): number;
    /** The text of the notice at the top of the screen; empty when it is not showing. */
    notice(): string;
    /** What the addon keeps in the character's saved variables. */
    getSavedSettings(): Record<string, unknown> | undefined;
    findFrame(matches: (frame: FakeFrame) => boolean): FakeFrame | undefined;
}

function loadAddon(): void {
    const [chunk, error] = loadfile(config.addonPath);
    if (chunk === undefined) throw new Error(`cannot load the addon from "${config.addonPath}": ${error}`);
    // The game runs each addon file with (addonName, addonTable)
    (chunk as (...args: unknown[]) => unknown)("ForeverReminders", {});
}

export function createWorld(setup: (state: ClientState) => void): World {
    clearGlobal("ForeverRemindersCharDB");
    const state = createClientState();
    setup(state);
    const clock = createClock();
    const frames = createFrameRegistry();
    const chat: string[] = [];
    const sounds: number[] = [];
    const proxySettings: ProxySettings = {};

    installClock(clock);
    installUnits(state);
    installSpells(state);
    installUi(frames, chat, proxySettings);
    installActionBars(state, frames);
    installAuras(state);
    installItems(state, sounds);

    loadAddon();
    frames.fire("ADDON_LOADED", "ForeverReminders", false);
    frames.fire("PLAYER_LOGIN");
    frames.fire("PLAYER_ENTERING_WORLD", true, false);
    clock.advance(1);

    return {
        state,
        chat,
        sounds,
        proxySettings,
        setOption(name, value) {
            const setting = proxySettings[`ForeverReminders_${name}`];
            if (setting === undefined) throw new Error(`the options page has no setting "${name}"`);
            setting.set(value);
        },
        frames: frames.all,
        fire: (event, ...args) => frames.fire(event, ...args),
        advance: (seconds) => clock.advance(seconds),
        makeAura: (name, spellId, secondsLeft, sourceUnit) => ({ name, spellId, expirationTime: clock.getNow() + secondsLeft, sourceUnit }),
        glowsOn(button) {
            const buttonFrame = readGlobal(`ActionButton${button}`);
            return frames.all.filter(
                (frame) => frame.parent === buttonFrame && frame.template === "ActionButtonSpellAlertTemplate" && frame.isShown,
            ).length;
        },
        notice() {
            const noticeFrame = frames.all.find((frame) => frame.parent === readGlobal("UIParent") && frame.fontStrings.length > 0);
            return noticeFrame?.isShown ? (noticeFrame.fontStrings[0]?.text ?? "") : "";
        },
        getSavedSettings: () => readGlobal("ForeverRemindersCharDB") as Record<string, unknown> | undefined,
        findFrame: (matches) => frames.all.find((frame) => matches(frame)),
    };
}
