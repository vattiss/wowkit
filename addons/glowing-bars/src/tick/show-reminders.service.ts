// Stage 2 of a tick: show the reminders. A sound when something new appears, the notice text, and
// the glows on the action buttons. It remembers what it showed last time, so only a change is
// shown again.

import type { MessagesService, SoundKey } from "@wowkit/ui";
import type { StyleService } from "../settings/style.service";
import type { AddonSettingsService, ColorKey } from "../settings/settings.interface";
import type { ActionBarsService, GlowService, ButtonGlow, Rgb } from "@wowkit/wow";
import type { NoticesService } from "./notices.service";
import type { Reminders } from "./tick.interface";

/** One kind of reminder: the setting that switches it on, and the spells of the reminders that make it glow. */
interface GlowKind {
    category: ColorKey;
    isOnSetting: "showBuff" | "showWeapon" | "showSeals" | "showTracking" | "showCooldowns" | "showProcs" | "showRanks" | "showReagents";
    findSpells: (this: void, reminders: Reminders) => number[];
}

const KINDS: GlowKind[] = [
    { category: "buff", isOnSetting: "showBuff", findSpells: (reminders) => reminders.buffsToCast },
    {
        category: "weapon",
        isOnSetting: "showWeapon",
        findSpells: (reminders) => [
            ...(reminders.weaponSpell !== undefined ? [reminders.weaponSpell] : []),
            ...reminders.customWeaponSpells,
        ],
    },
    { category: "seal", isOnSetting: "showSeals", findSpells: (reminders) => reminders.seals },
    { category: "tracking", isOnSetting: "showTracking", findSpells: (reminders) => reminders.trackings },
    { category: "cooldown", isOnSetting: "showCooldowns", findSpells: (reminders) => reminders.readyCooldowns },
    { category: "proc", isOnSetting: "showProcs", findSpells: (reminders) => reminders.procs },
    { category: "rank", isOnSetting: "showRanks", findSpells: (reminders) => reminders.outdatedRanks.map((rank) => rank.id) },
    { category: "reagent", isOnSetting: "showReagents", findSpells: (reminders) => reminders.reagentSpells },
];

/** The spells that glow in one color and opacity: one glow shows them. */
interface GlowGroup {
    /** The look as text: the glow of the group is kept under it. */
    key: string;
    color: Rgb;
    opacity: number;
    spells: number[];
}

export class ShowRemindersService {
    /** The glows made so far, by the look they give (color and opacity); one that is not needed any more is cleared, not dropped. */
    private readonly glows = new LuaMap<string, ButtonGlow>();
    /** The spells of each kind in the previous tick, to tell what is new. */
    private previous: number[][] = KINDS.map(() => []);
    /** The glows of the previous tick as one text; undefined makes the next tick set the glows again. */
    private shownGlowKey: string | undefined;

    constructor(
        private readonly glow: GlowService,
        private readonly messages: MessagesService,
        private readonly settings: AddonSettingsService,
        private readonly notices: NoticesService,
        private readonly styles: StyleService,
        private readonly actionBars: ActionBarsService,
    ) {}

    showReminders(reminders: Reminders): void {
        this.playSoundsForNewReminders(reminders);
        this.notices.showNoticeIfNew(reminders);
        this.updateGlows(reminders);
    }

    /** The buttons or the spells changed under the glows: set them again on the next tick. */
    markGlowsStale(): void {
        this.shownGlowKey = undefined;
    }

    /** A setting changed: the glows go out at once and are lit again by the next tick, in the new look. */
    redrawGlowsAfterSettingChange(key: string): void {
        if (
            key !== "styles" &&
            key !== "spellStyles" &&
            key !== "barOff" &&
            key !== "idOverrides" &&
            key !== "customCues" &&
            !KINDS.some((kind) => kind.isOnSetting === key)
        )
            return;
        for (const [, glow] of this.glows) glow.clear();
        this.markGlowsStale();
    }

    /** A sound when a glow starts for a spell, in the spell's own sound; not each time another one goes out. */
    private playSoundsForNewReminders(reminders: Reminders): void {
        const sounds: SoundKey[] = [];
        KINDS.forEach((kind, index) => {
            const spells = kind.findSpells(reminders);
            for (const id of spells) {
                if (this.previous[index]!.includes(id)) continue;
                const sound = this.styles.getStyle(kind.category, id).sound;
                if (!sounds.includes(sound)) sounds.push(sound);
            }
            this.previous[index] = spells;
        });
        for (const sound of sounds) this.messages.playAlertSound(sound);
    }

    private updateGlows(reminders: Reminders): void {
        const groups = this.listGroups(reminders);
        const glowKey = groups.map((group) => `${group.key}=${group.spells.join(",")}`).join(";");
        if (glowKey === this.shownGlowKey) return;
        this.shownGlowKey = glowKey;
        // A look that no spell has now: its glow goes out
        for (const [key, glow] of this.glows) if (!groups.some((group) => group.key === key)) glow.clear();
        for (const group of groups) {
            let glow = this.glows.get(group.key);
            if (glow === undefined) {
                glow = this.glow.createButtonGlow(group.key, (button) => this.isBarShown(button));
                this.glows.set(group.key, glow);
            }
            glow.show(group.spells, group.color);
            glow.setAlpha(group.opacity / 100);
        }
    }

    /** A button glows unless its bar is switched off (a button of no numbered bar always may). */
    private isBarShown(button: ActionButton): boolean {
        const bar = this.actionBars.getBarNumber(button);
        return bar === undefined || this.settings.get("barOff")[string.format("%d", bar)] !== true;
    }

    /** The spells to glow, in groups of the same look. */
    private listGroups(reminders: Reminders): GlowGroup[] {
        const groups: GlowGroup[] = [];
        for (const kind of KINDS) {
            for (const id of kind.findSpells(reminders)) {
                const style = this.styles.getStyle(kind.category, id);
                const key = `${style.color.join(",")}|${style.opacity}`;
                const group = groups.find((candidate) => candidate.key === key);
                if (group === undefined) groups.push({ key, color: style.color, opacity: style.opacity, spells: [id] });
                else if (!group.spells.includes(id)) group.spells.push(id);
            }
        }
        return groups;
    }
}
