// The player's proc rules on the health (beta): "glow Holy Light while my health is at or below 35%". The game hides the
// health from addons, so, as with Templar's Bulwark, the glow is lit while the spell is ready and the game fades it through
// a curve: it shows only below the percent. A spell a rule the addon can read lit already has nothing to add. Each rule
// glows with the look of its group's row ("Holy Light (my health <= 35%)"), where nothing that needs to know when the glow
// starts (sound, repeat, glow time) can be set; one message at a time, the first rule's, as faded as its glow.
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
import { buildGroupSwitchKey, findHealthGroup, type ProcRule } from "./proc-rules.interface";
import type { ProcRulesService } from "./proc-rules.service";

/** The curve's short ramp ends this far below the percent, where the glow is full. */
const CURVE_RAMP = 2;

/** A rule's glow: the glow of its animation, and its one spell in a list kept for it. */
interface RuleGlow {
    glow: ButtonGlow;
    animation: GlowAnimation;
    spellIds: number[];
}

export class HealthRulesService {
    /** Each rule's glow, by its spell and group. */
    private readonly glows = new LuaMap<string, RuleGlow>();
    private readonly litKeys = new LuaSet<string>();
    private readonly whenState = createWhenState();
    private isTextShown = false;

    constructor(
        private readonly procRules: ProcRulesService,
        private readonly glowCues: GlowCuesService,
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly glowService: GlowService,
        private readonly notice: NoticeService,
        private readonly curves: ValueCurvesService,
        private readonly styles: StyleService,
        private readonly settings: AddonSettingsService,
        private readonly locale: AddonLocale,
        private readonly idle: IdleService,
        private readonly barKeys: BarKeysService,
    ) {}

    /** The opacity is only true for a moment: it is asked of the game again and again. */
    @Interval(250)
    updateGlows(): void {
        for (const key of this.litKeys) this.litKeys.delete(key);
        let hasText = false;
        if (this.isAllowed()) {
            for (const rule of this.procRules.listOwnHealthRules()) hasText = this.showRule(rule, hasText) || hasText;
        }
        for (const [key, ruleGlow] of this.glows) if (!this.litKeys.has(key)) ruleGlow.glow.clear();
        if (!hasText) this.clearText();
    }

    private isAllowed(): boolean {
        if (!this.procRules.isOn() || !this.settings.get("isProcEnabled") || this.settings.get("isDisabled")) return false;
        return !this.idle.shouldStayIdle(false);
    }

    /** Lights the rule's glow if its spell is ready on a bar and nothing else lit it; returns whether it put a message up. */
    private showRule(rule: ProcRule, hasText: boolean): boolean {
        const spellId = this.spells.resolve(rule.spellId);
        if (spellId === undefined || !this.actionBars.isOnBars(spellId) || this.glowCues.isOnCooldown(spellId)) return false;
        if (this.procRules.isLitNow(spellId) || !this.hasUnit(rule)) return false;
        const group = findHealthGroup(rule);
        if (this.settings.get("enabledSpells")[buildGroupSwitchKey(rule.spellId, group)] === false) return false;
        const style = this.styles.getGroupStyle(rule.spellId, group);
        if (!readWhenState(this.player, this.whenState)[style.when]) return false;
        const unit = rule.kind === "targetHealth" ? "target" : "player";
        const percent = (rule.value ?? 0) + CURVE_RAMP;
        const alpha = this.curves.getHealthAlpha(unit, percent, "below", style.glowPercent / 100);
        if (alpha === undefined) return false;
        const key = `${rule.spellId}:${group}`;
        const ruleGlow = this.takeGlow(key, style.animation);
        ruleGlow.spellIds[0] = spellId;
        ruleGlow.glow.show(ruleGlow.spellIds, style.color);
        ruleGlow.glow.setAlpha(alpha);
        this.litKeys.add(key);
        return !hasText && this.showText(spellId, style, unit, percent);
    }

    /** A rule on the target's health needs a living enemy targeted; one on the player's, a living player. */
    private hasUnit(rule: ProcRule): boolean {
        return rule.kind === "targetHealth" ? this.player.hasEnemyTarget() : !this.player.isDead();
    }

    /** Its message, if the player wants one: as hidden from the addon as the glow is. */
    private showText(spellId: number, style: Style, unit: UnitToken, percent: number): boolean {
        const alpha = style.isMessageOn ? this.curves.getHealthAlpha(unit, percent, "below") : undefined;
        if (alpha === undefined) return false;
        const choice = style.messageTextChoice ?? "typeOnly";
        const { words } = findWords(choice, style.messageText, this.locale.getText("TEXT_PROC"), this.spells.getSpellLabel(spellId));
        const text = this.styles.applyTextColor(style.messageColor ?? style.color, words);
        this.notice.showFadedText(text, alpha, { scale: this.settings.get("messageSize") / 100, top: this.settings.get("messageTop") });
        this.isTextShown = true;
        return true;
    }

    private clearText(): void {
        if (!this.isTextShown) return;
        this.notice.clearFadedText();
        this.isTextShown = false;
    }

    /** The glow of this rule in this animation: one made for another goes out. */
    private takeGlow(key: string, animation: GlowAnimation): RuleGlow {
        const kept = this.glows.get(key);
        if (kept !== undefined && kept.animation === animation) return kept;
        kept?.glow.clear();
        const glow = this.glowService.createButtonGlow(`healthRule:${key}:${animation}`, animation, (button) => this.isBarShown(button));
        const ruleGlow = { glow, animation, spellIds: [] };
        this.glows.set(key, ruleGlow);
        return ruleGlow;
    }

    private isBarShown(button: ActionButton): boolean {
        if (!this.settings.get("shouldGlowOnMacros") && this.actionBars.isMacroButton(button)) return false;
        const bar = this.barKeys.getBarKey(button);
        return bar === undefined || this.settings.get("barsThatGlow")[bar] !== false;
    }
}
