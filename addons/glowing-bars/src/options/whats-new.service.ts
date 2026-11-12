// What the account has seen of the addon's releases, kept in the account's saved data (## SavedVariables): the last
// version it logged in with, and whether the What's New and the Welcome tabs may open by themselves. Each does only for a
// player who asked for it (both were on unless switched off, and are off for everyone since); Welcome also on the first
// character of a new install, where the player makes that choice. After an update, at login, the settings
// window opens on it once if a release since then has something new, out of combat; a new player is told nothing
// (everything is new to them).
import { OnGameEvent, type OnAddonLoaded, type OnLogin } from "@wowkit/core";
import type { OptionsTab } from "@wowkit/ui";
import type { ClockService, PlayerService, SavedVariablesService } from "@wowkit/wow";
import { ADDON_VERSION, RELEASE_NOTES } from "../changelog/release-notes.generated";
import type { AddonLocale } from "../locale/locale.interface";
import { buildNotesView } from "./whats-new-notes";

/** The window waits this long after login, for the screen to settle. */
const OPEN_DELAY = 3;

/** What the account keeps. */
interface AccountData {
    /** The version the account last logged in with. */
    lastVersion?: string;
    /** The player ticked "Show what's new after new features": the window opens by itself after them. */
    isWhatsNewOn?: boolean;
    /** The player ticked "Show the Welcome tab on new characters": it opens by itself on each new one. */
    isWelcomeOn?: boolean;
    /** The old switch of the Welcome tab, which was on unless unticked. Dropped: it is off for everyone now. */
    isWelcomeOff?: boolean;
    /** The old switch of What's New, which was on unless ticked off. Dropped: it is off for everyone now. */
    isWhatsNewOff?: boolean;
}

/** Is it a minor or major release: its third number 0, or none? */
export function isMinorRelease(version: string): boolean {
    const [patch] = string.match(version, "^%d+%.%d+%.(%d+)");
    return patch === undefined || tonumber(patch) === 0;
}

/** Is version `a` newer than `b`? Their numbers compared one by one. */
export function isNewerVersion(a: string, b: string): boolean {
    const [partsA, partsB] = [string.gsub(a, "[^%d.]", "")[0], string.gsub(b, "[^%d.]", "")[0]];
    const numbersA: number[] = [];
    const numbersB: number[] = [];
    for (const [part] of string.gmatch(partsA, "(%d+)")) numbersA.push(tonumber(part) ?? 0);
    for (const [part] of string.gmatch(partsB, "(%d+)")) numbersB.push(tonumber(part) ?? 0);
    for (let index = 0; index < math.max(numbersA.length, numbersB.length); index++) {
        const difference = (numbersA[index] ?? 0) - (numbersB[index] ?? 0);
        if (difference !== 0) return difference > 0;
    }
    return false;
}

export class WhatsNewService implements OnAddonLoaded, OnLogin {
    private data: AccountData = {};
    private openTab: ((this: void) => void) | undefined;
    private tab: OptionsTab | undefined;
    /** The window is due, and waits for the fight to end. */
    private isWaitingForPeace = false;
    /** This character gets the Welcome tab first. */
    private isHeldForWelcome = false;
    /** The account had never logged in with the addon: a new install, its first character. */
    private isFirstInstall = false;

    constructor(
        private readonly saved: SavedVariablesService,
        private readonly locale: AddonLocale,
        private readonly clock: ClockService,
        private readonly player: PlayerService,
    ) {}

    /** The tab in the settings window, and how to open the window on it. */
    useTab(tab: OptionsTab, open: (this: void) => void): void {
        this.tab = tab;
        this.openTab = open;
    }

    getTab(): OptionsTab | undefined {
        return this.tab;
    }

    /** The versions on the left, the notes of the one picked on the right, filling the tab. */
    addNotes(tab: OptionsTab, width: number, height: number): void {
        tab.addCustomRow(height, (row) => buildNotesView(row, this.locale, width, height), width);
    }

    onAddonLoaded(): void {
        this.data = this.saved.loadTable<AccountData>() ?? {};
        this.data.isWhatsNewOff = undefined;
        this.data.isWelcomeOff = undefined;
        this.isFirstInstall = this.data.lastVersion === undefined;
        this.saved.bindTable(this.data);
    }

    /** At login: the window, if a release since the last login has something new; the version is noted either way. */
    onLogin(): void {
        const last = this.data.lastVersion;
        this.data.lastVersion = ADDON_VERSION;
        if (last === undefined || !this.isWhatsNewShown()) return;
        // Only a minor or major release with something new opens it (2.9.0, not 2.9.1)
        const hasNew = RELEASE_NOTES.some(
            (note) =>
                note.hasNew &&
                isMinorRelease(note.version) &&
                isNewerVersion(note.version, last) &&
                !isNewerVersion(note.version, ADDON_VERSION),
        );
        if (hasNew) this.clock.runAfter(OPEN_DELAY, () => this.openUnlessHeld());
    }

    /** The Welcome tab opens on this character: What's New is one tab over. */
    useWelcomeFirst(): void {
        this.isHeldForWelcome = true;
    }

    private openUnlessHeld(): void {
        if (!this.isHeldForWelcome) this.openWhenAtPeace();
    }

    isWhatsNewShown(): boolean {
        return this.data.isWhatsNewOn === true;
    }

    setWhatsNewShown(isShown: boolean): void {
        this.data.isWhatsNewOn = isShown || undefined;
    }

    isWelcomeShown(): boolean {
        return this.data.isWelcomeOn === true;
    }

    setWelcomeShown(isShown: boolean): void {
        this.data.isWelcomeOn = isShown || undefined;
    }

    /** Is this the first character of a new install? It gets the Welcome tab, whatever the switch says. */
    isNewInstall(): boolean {
        return this.isFirstInstall;
    }

    /** A fight that ends opens the window that waited for it. */
    @OnGameEvent("PLAYER_REGEN_ENABLED")
    openAfterFight(): void {
        if (!this.isWaitingForPeace) return;
        this.isWaitingForPeace = false;
        this.openTab?.();
    }

    /** Not while the game locks down for a fight either: the same check the commands make. */
    private openWhenAtPeace(): void {
        if (this.player.isInCombat() || InCombatLockdown()) this.isWaitingForPeace = true;
        else this.openTab?.();
    }
}
