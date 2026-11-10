// The Welcome tab of the settings window opens by itself once for each character, as its settings are the character's,
// and once more on a character that has not seen the choice about Blizzard's Cooldown Manager; What's new waits for it.
// Its scan lights each action button it finds, in the colors of a rainbow, when the player asks for it.
import { OnGameEvent, type OnLogin } from "@wowkit/core";
import type { OptionsTab } from "@wowkit/ui";
import type { ButtonSearchResult, ButtonSearchService, ClockService, GlowService, PlayerService } from "@wowkit/wow";
import { RAINBOW, RAINBOW_LAST_SECONDS, RAINBOW_STEP_SECONDS } from "../glows/rainbow.constants";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ScanReport } from "./scan-report";
import type { WhatsNewService } from "./whats-new.service";

/** After login, like What's new. */
const OPEN_DELAY = 3;
const GLOW_KEY = "scan";

export class WelcomeService implements OnLogin {
    private isWaitingForPeace = false;
    private isScanning = false;
    private scanText = "";
    private report = "";
    private tab: OptionsTab | undefined;
    private openTab: ((this: void) => void) | undefined;

    constructor(
        private readonly search: ButtonSearchService,
        private readonly glow: GlowService,
        private readonly clock: ClockService,
        private readonly player: PlayerService,
        private readonly locale: AddonLocale,
        private readonly settings: AddonSettingsService,
        private readonly whatsNew: WhatsNewService,
        private readonly scanReport: ScanReport,
    ) {}

    /** The tab in the settings window, and how to open the window on it. */
    useTab(tab: OptionsTab, open: (this: void) => void): void {
        this.tab = tab;
        this.openTab = open;
    }

    /** What the scan says: that it runs, or what it found; empty before the first. */
    getScanText(): string {
        return this.scanText;
    }

    /** The text to copy for a bug report, once a scan is over. */
    getReport(): string {
        return this.report;
    }

    onLogin(): void {
        if (this.settings.get("isWelcomeDone") && this.settings.get("isCooldownChoiceSeen")) return;
        this.whatsNew.useWelcomeFirst();
        this.clock.runAfter(OPEN_DELAY, () => this.openWhenAtPeace());
    }

    @OnGameEvent("PLAYER_REGEN_ENABLED")
    openAfterFight(): void {
        if (!this.isWaitingForPeace) return;
        this.isWaitingForPeace = false;
        this.open();
    }

    /** Not while the game locks down for a fight either: the same check the commands make. */
    private openWhenAtPeace(): void {
        if (this.player.isInCombat() || InCombatLockdown()) this.isWaitingForPeace = true;
        else this.open();
    }

    private open(): void {
        this.settings.change("isWelcomeDone", true);
        this.settings.change("isCooldownChoiceSeen", true);
        this.openTab?.();
    }

    /** The buttons light up one after the other; the tab then says what was found. */
    scan(): void {
        if (this.isScanning) return;
        this.isScanning = true;
        this.scanText = this.locale.getText("WELCOME_SCANNING");
        this.tab?.refresh();
        this.search.findButtons((result) => this.showNextGlow(result, this.search.listBars(), 0));
    }

    /** On every bar at once, one button further from its start, each staying lit until the end; then what was found. */
    private showNextGlow(result: ButtonSearchResult, bars: ActionButton[][], step: number): void {
        let isAnyLeft = false;
        for (const bar of bars) {
            const button = bar[step];
            if (button === undefined) continue;
            isAnyLeft = true;
            this.glow.showButtonGlow(GLOW_KEY, button, RAINBOW[step % RAINBOW.length]!, "circling");
        }
        if (isAnyLeft) this.clock.runAfter(RAINBOW_STEP_SECONDS, () => this.showNextGlow(result, bars, step + 1));
        else this.clock.runAfter(RAINBOW_LAST_SECONDS, () => this.showScanResult(result));
    }

    private showScanResult(result: ButtonSearchResult): void {
        for (const button of result.buttons) this.glow.clearButtonGlow(GLOW_KEY, button);
        this.isScanning = false;
        this.scanText = this.describe(result);
        this.report = this.scanReport.buildReport(result);
        this.tab?.refresh();
    }

    private describe(result: ButtonSearchResult): string {
        if (result.buttons.length === 0) return this.locale.getText("WELCOME_NO_BUTTONS");
        return string.format(this.locale.getText("WELCOME_FOUND"), result.buttons.length, result.found.length, result.hiddenCount);
    }
}
