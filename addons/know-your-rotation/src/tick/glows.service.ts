// Lights up what a tick found: each cue its own glow and color on the action buttons. The glows that follow a hidden
// value (health, mana) get their opacity from the client every tick.
import { OnEvent } from "@wowkit/core";
import type { ButtonGlow, GlowService, Rgb, ValueCurvesService } from "@wowkit/wow";
import type { HiddenCue } from "../cues/hidden-cues.service";
import { getGlowColor } from "../settings/settings.colors";
import { CLEANSE_COLOR, INTERRUPT_COLOR, PURGE_COLOR } from "../settings/settings.constants";
import type { AddonSettingsService, ColorKey } from "../settings/settings.interface";
import type { Cues } from "./cues.interface";

type GlowKind = "next" | "heal" | "defense" | "interrupt" | "purge" | "cleanse" | "totem" | "shot";
type HiddenKind = "hiddenHeal" | "hiddenDefense" | "hiddenExecute" | "hiddenPetHeal" | "hiddenMana";

/** The glows on hidden values: the unit whose value fades them, and their color. */
const HIDDEN_GLOWS: { [kind in HiddenKind]: { unit: UnitToken | "mana"; color: ColorKey } } = {
    hiddenHeal: { unit: "player", color: "heal" },
    hiddenDefense: { unit: "player", color: "defense" },
    hiddenExecute: { unit: "target", color: "next" },
    hiddenPetHeal: { unit: "pet", color: "heal" },
    hiddenMana: { unit: "mana", color: "next" },
};

export class GlowsService {
    private readonly glows: { [kind in GlowKind | HiddenKind]: ButtonGlow };

    constructor(
        glow: GlowService,
        private readonly curves: ValueCurvesService,
        private readonly settings: AddonSettingsService,
    ) {
        const kinds: (GlowKind | HiddenKind)[] = ["next", "heal", "defense", "interrupt", "purge", "cleanse", "totem", "shot"];
        for (const kind of Object.keys(HIDDEN_GLOWS) as HiddenKind[]) kinds.push(kind);
        const glows = {} as { [kind in GlowKind | HiddenKind]: ButtonGlow };
        for (const kind of kinds) glows[kind] = glow.createButtonGlow(`kyr-${kind}`);
        this.glows = glows;
    }

    /** The buttons changed under the glows (the bars were mapped again): the next tick lights them anew. */
    @OnEvent("bars.mapped")
    clearGlows(): void {
        for (const [, glow] of pairs(this.glows)) glow.clear();
    }

    showCues(cues: Cues): void {
        this.showRotation(cues);
        const defense = cues.defense;
        this.show("defense", defense ? [defense.spellId] : [], defense?.isHeal === true ? this.getColor("heal") : this.getColor("defense"));
        this.show("interrupt", cues.interrupt !== undefined ? [cues.interrupt] : [], INTERRUPT_COLOR);
        this.show("purge", cues.purge !== undefined ? [cues.purge] : [], PURGE_COLOR);
        this.show("cleanse", cues.cleanse !== undefined ? [cues.cleanse] : [], CLEANSE_COLOR);
        this.show("totem", cues.totems, this.getColor("totem"));
        this.show("shot", cues.shots, this.getColor("shot"));
        for (const kind of Object.keys(HIDDEN_GLOWS) as HiddenKind[]) this.showHidden(kind, cues[kind]);
        this.setRotationFade(cues);
    }

    private showRotation(cues: Cues): void {
        const rotation = cues.rotation;
        if (!rotation) {
            this.glows.next.clear();
            this.glows.heal.clear();
        } else if (rotation.isHeal) {
            this.glows.next.clear();
            this.show("heal", [rotation.spellId], this.getColor(rotation.isQuickHeal ? "healNow" : "heal"));
        } else {
            this.glows.heal.clear();
            this.show("next", [rotation.spellId], this.getColor("next"));
        }
    }

    /** The glow of a hidden value: lit by the client as the value passes the threshold. */
    private showHidden(kind: HiddenKind, cue: HiddenCue | undefined): void {
        const glow = this.glows[kind];
        const alpha = cue ? this.getHiddenAlpha(HIDDEN_GLOWS[kind].unit, cue.threshold, "below") : undefined;
        // Without the client's curve there is no way to show it: no glow rather than a wrong one
        if (!cue || alpha === undefined) return glow.clear();
        glow.show([cue.spellId], this.getColor(HIDDEN_GLOWS[kind].color));
        glow.setAlpha(alpha);
    }

    /**
     * A finisher waits for a low target: the rotation glow fades out exactly where the finisher's fades in (both from the
     * same hidden health), so only one shows. A heal on a party member: its glow is lit by that member's health.
     */
    private setRotationFade(cues: Cues): void {
        const heal = cues.healFade;
        const finisher = cues.finisherFade;
        const alpha = heal
            ? this.curves.getHealthAlpha(heal.unit, heal.threshold, "below")
            : finisher
              ? this.curves.getHealthAlpha("target", finisher.threshold, "above")
              : undefined;
        this.glows.next.setAlpha(alpha);
        this.glows.heal.setAlpha(heal ? alpha : undefined);
    }

    private getHiddenAlpha(unit: UnitToken | "mana", threshold: number, side: "below" | "above") {
        return unit === "mana" ? this.curves.getManaAlpha(threshold, side) : this.curves.getHealthAlpha(unit, threshold, side);
    }

    private show(kind: GlowKind, spellIds: number[], color: Rgb): void {
        this.glows[kind].show(spellIds, color);
    }

    private getColor(key: ColorKey): Rgb {
        return getGlowColor(this.settings, key);
    }
}
