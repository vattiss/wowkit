// A last-resort defensive at low health: a paladin's Templar's Bulwark (an idea of sorrow8's fork). The game hides the
// player's health from addons, so the glow is lit on the button all the while it is ready, and its opacity comes from that
// hidden health through a curve (see ValueCurvesService), as Execute's in Defensive Stance does: it shows only at 10% health
// or below. Its message, if the player wants one, does the same. The addon never learns whether they show: no sound and no
// glow time can follow them, and the table fades those on its row.
import { Interval } from "@wowkit/core";
import type {
    ActionBarsService,
    BarKeysService,
    ButtonGlow,
    GlowAnimation,
    GlowService,
    NoticeService,
    PlayerService,
    SpellsService,
    ValueCurvesService,
} from "@wowkit/wow";
import type { IdleService } from "../character/idle.service";
import type { AddonLocale } from "../locale/locale.interface";
import type { AddonSettingsService, Style } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { findWords } from "../tick/message-words";
import { createWhenState, readWhenState } from "../tick/when-state";
import type { GlowCuesService } from "./glow-cues.service";

/** The curve ends here: its short ramp is over at 10% health, where the glow is full. */
const CURVE_END_PERCENT = 12;

export class LowHealthDefenseService {
    private glow: ButtonGlow | undefined;
    private glowAnimation: GlowAnimation | undefined;
    private readonly whenState = createWhenState();
    /** The one spell of the glow: the same list at every look. */
    private readonly spellIds: number[] = [];
    /** Did this service put its message up? The faded text is one for every service: only its own is taken down. */
    private isTextShown = false;

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly glows: GlowService,
        private readonly notice: NoticeService,
        private readonly curves: ValueCurvesService,
        private readonly styles: StyleService,
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly idle: IdleService,
        private readonly barKeys: BarKeysService,
        private readonly glowCues: GlowCuesService,
    ) {}

    /** The opacity is only true for a moment: it is asked of the game again and again. */
    @Interval(250)
    updateGlow(): void {
        const spellId = this.findDefensive();
        const style = spellId !== undefined ? this.styles.getStyle("proc", spellId) : undefined;
        const alpha =
            spellId !== undefined && style !== undefined && readWhenState(this.player, this.whenState)[style.when]
                ? this.curves.getHealthAlpha("player", CURVE_END_PERCENT, "below", style.glowPercent / 100)
                : undefined;
        if (spellId === undefined || style === undefined || alpha === undefined) {
            this.glow?.clear();
            this.clearText();
            return;
        }
        this.updateText(spellId, style);
        const glow = this.takeGlow(style.animation);
        this.spellIds[0] = spellId;
        glow.show(this.spellIds, style.color);
        glow.setAlpha(alpha);
    }

    /** Its message, if the player wants one: as hidden from the addon as the glow is. */
    private updateText(spellId: number, style: Style): void {
        const alpha = style.isMessageOn ? this.curves.getHealthAlpha("player", CURVE_END_PERCENT, "below") : undefined;
        if (alpha === undefined) {
            this.clearText();
            return;
        }
        const choice = this.styles.getMessageTextChoice("proc", spellId);
        const { words } = findWords(choice, style.messageText, this.locale.getText("TEXT_PROC"), this.spells.getSpellLabel(spellId));
        const text = this.styles.applyTextColor(style.messageColor ?? style.color, words);
        this.notice.showFadedText(text, alpha, { scale: this.settings.get("messageSize") / 100, top: this.settings.get("messageTop") });
        this.isTextShown = true;
    }

    private clearText(): void {
        if (!this.isTextShown) return;
        this.notice.clearFadedText();
        this.isTextShown = false;
    }

    /** The defensive to light: the class's, learned, on a bar, switched on and off its cooldown. */
    private findDefensive(): number | undefined {
        if (!this.settings.get("isProcEnabled") || this.settings.get("isDisabled") || this.idle.shouldStayIdle(false)) return undefined;
        for (const listId of this.glowCues.listLowHealthIds()) {
            if (this.settings.get("enabledSpells")[string.format("%d", listId)] === false) continue;
            const spellId = this.spells.resolve(listId);
            if (spellId !== undefined && this.actionBars.isOnBars(spellId) && !this.glowCues.isOnCooldown(spellId)) return spellId;
        }
        return undefined;
    }

    /** The glow of this animation: one made for another goes out. */
    private takeGlow(animation: GlowAnimation): ButtonGlow {
        if (this.glow !== undefined && this.glowAnimation === animation) return this.glow;
        this.glow?.clear();
        this.glow = this.glows.createButtonGlow(`lowHealthDefense:${animation}`, animation, (button) => this.isBarShown(button));
        this.glowAnimation = animation;
        return this.glow;
    }

    private isBarShown(button: ActionButton): boolean {
        if (!this.settings.get("shouldGlowOnMacros") && this.actionBars.isMacroButton(button)) return false;
        const bar = this.barKeys.getBarKey(button);
        return bar === undefined || this.settings.get("barsThatGlow")[bar] !== false;
    }
}
