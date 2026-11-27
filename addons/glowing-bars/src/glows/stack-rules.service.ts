// The proc rules on a buff's stacks (beta): "glow Unsealed Wrath at 3 stacks". The rule's spell glows, on its buttons and its
// icons in the Cooldown Manager. Out of a fight the addon reads the stacks and compares them itself. In a fight the game hides
// the number (a secret value): the glow is lit while the buff's icon has an aura, and a gate the game drives lets it through
// only at the stacks (see glow-gate.utils). Whenever the stacks cannot be told, or a gate cannot be made, it stays dark:
// never a glow by a guess. Each rule glows with the look of its group's row ("Unsealed Wrath (3 stacks)"), where nothing
// that needs to know when the glow starts (sound, repeat, glow time) can be set.
import { Interval } from "@wowkit/core";
import {
    createGlowGate,
    applyGateMask,
    readPlayerAuraStacks,
    setGateThreshold,
    setGateValue,
    tryCall,
    type ActionBarsService,
    type BarKeysService,
    type BuffStacks,
    type ButtonGlow,
    type CooldownViewerService,
    type GlowAnimation,
    type GlowGate,
    type GlowService,
    type PlayerService,
    type SpellsService,
} from "@wowkit/wow";
import type { IdleService } from "../character/idle.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { StyleService } from "../settings/style.service";
import { createWhenState, readWhenState } from "../tick/when-state";
import type { GlowCuesService } from "./glow-cues.service";
import { buildGroupSwitchKey, findGlowOnlyGroup, findRuleStacks, type ProcRule } from "./proc-rules.interface";
import type { ProcRulesService } from "./proc-rules.service";

/** A rule's glow: the glow of its animation, and its one spell in a list kept for it. */
interface RuleGlow {
    glow: ButtonGlow;
    animation: GlowAnimation;
    spellIds: number[];
}

export class StackRulesService {
    /** Each rule's glow, by its spell and group. */
    private readonly glows = new LuaMap<string, RuleGlow>();
    private readonly litKeys = new LuaSet<string>();
    /** The gate of each frame of the glows, made the first time the stacks are hidden: kept, as the frames are. */
    private readonly gates = new LuaMap<Frame, GlowGate>();
    private readonly whenState = createWhenState();

    constructor(
        private readonly procRules: ProcRulesService,
        private readonly glowCues: GlowCuesService,
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly actionBars: ActionBarsService,
        private readonly glowService: GlowService,
        private readonly viewer: CooldownViewerService,
        private readonly styles: StyleService,
        private readonly settings: AddonSettingsService,
        private readonly idle: IdleService,
        private readonly barKeys: BarKeysService,
    ) {}

    /** The stacks change with each hit: asked again and again (nothing to do for a class with no such rule). */
    @Interval(200)
    updateGlows(): void {
        for (const key of this.litKeys) this.litKeys.delete(key);
        if (this.isAllowed()) {
            // An error leaves the rule's glow unlit: it goes out below
            for (const rule of this.procRules.listStackRules()) tryCall(() => this.showRule(rule));
        }
        for (const [key, ruleGlow] of this.glows) if (!this.litKeys.has(key)) ruleGlow.glow.clear();
    }

    private isAllowed(): boolean {
        if (!this.procRules.isOn() || !this.settings.get("isProcEnabled") || this.settings.get("isDisabled")) return false;
        return !this.idle.shouldStayIdle(false);
    }

    /** One glow for a group, as one row: every rule of the spell (any rank) with that group lights the same. */
    private findKey(rule: ProcRule): string {
        return `${this.spells.getSpellLabel(rule.spellId) ?? string.format("%d", rule.spellId)}:${findGlowOnlyGroup(rule)}`;
    }

    /** Lights the rule's glow when its spell may glow and its buff has the stacks, or the game alone can tell. */
    private showRule(rule: ProcRule): void {
        const spellId = this.findReadySpell(rule);
        if (spellId === undefined) return;
        const group = findGlowOnlyGroup(rule);
        const name = this.spells.getSpellLabel(rule.spellId) ?? string.format("%d", rule.spellId);
        if (this.settings.get("enabledSpells")[buildGroupSwitchKey(name, group)] === false) return;
        const style = this.styles.getGroupStyle(rule.spellId, group);
        if (!readWhenState(this.player, this.whenState)[style.when]) return;
        const stacks = this.readStacks(rule.value ?? 0);
        const threshold = findRuleStacks(rule);
        if (stacks === undefined || (!stacks.isSecret && stacks.count < threshold)) return;
        const key = this.findKey(rule);
        const ruleGlow = this.takeGlow(key, style.animation);
        ruleGlow.spellIds[0] = spellId;
        ruleGlow.glow.show(ruleGlow.spellIds, style.color);
        if (this.applyGates(ruleGlow.glow, stacks, threshold)) this.litKeys.add(key);
    }

    /**
     * The spell the rule may light: switched on, off its cooldown, lit by no rule the addon can read; undefined when not. It
     * need not be on a bar: its icon in the Cooldown Manager glows too (a buff's own, Unsealed Wrath).
     */
    private findReadySpell(rule: ProcRule): number | undefined {
        if (this.settings.get("enabledSpells")[string.format("%d", rule.spellId)] === false) return undefined;
        const spellId = this.spells.resolve(rule.spellId) ?? rule.spellId;
        if (this.glowCues.isOnCooldown(spellId) || this.procRules.isLitNow(spellId)) return undefined;
        return spellId;
    }

    /**
     * The buff's stacks: by its aura, as the game hands it (in a fight its number may be secret, or the aura not handed
     * at all); else by its icon in the Cooldown Manager. Out of a fight no aura and no icon is no buff; in one, nobody can tell.
     */
    private readStacks(buffId: number): BuffStacks | undefined {
        const fromAura = readPlayerAuraStacks(buffId);
        if (fromAura !== undefined) return fromAura;
        const name = this.spells.getSpellName(buffId);
        const fromIcon = name !== undefined ? this.viewer.readBuffStacks(name) : undefined;
        if (fromIcon !== undefined) return fromIcon;
        return this.player.isInCombat() ? undefined : { count: 0, isSecret: false };
    }

    /**
     * Each lit frame of the glow gets the gate that lets it through at the stacks: only once a number was secret, a plain one
     * opens the gate a frame has. False when a frame cannot be kept dark below the stacks: the glow then goes out.
     */
    private applyGates(glow: ButtonGlow, stacks: BuffStacks, threshold: number): boolean {
        // A buff that is there has a stack: at 1 its aura is enough
        const isGated = stacks.isSecret && threshold > 1;
        let isSafe = true;
        glow.applyToFrames((frame) => {
            let gate = this.gates.get(frame);
            if (gate === undefined && !isGated) return;
            gate ??= createGlowGate(frame, threshold);
            if (gate === undefined) {
                isSafe = false;
                return;
            }
            this.gates.set(frame, gate);
            if (gate.threshold !== threshold) setGateThreshold(gate, threshold);
            if (!applyGateMask(gate, frame) && isGated) isSafe = false;
            setGateValue(gate, isGated ? stacks.count : threshold);
        });
        return isSafe;
    }

    /** The glow of this rule in this animation: one made for another goes out. */
    private takeGlow(key: string, animation: GlowAnimation): RuleGlow {
        const kept = this.glows.get(key);
        if (kept !== undefined && kept.animation === animation) return kept;
        kept?.glow.clear();
        const glow = this.glowService.createButtonGlow(
            `stackRule:${key}:${animation}`,
            animation,
            (button) => this.isBarShown(button),
            "buffIcons",
        );
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
