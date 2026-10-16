// The reminder glow on action buttons: Blizzard's spell-alert ("proc") animation, tinted with the
// reminder's color.
import { buttonsFor } from "./action-bars";
import { settings, type ColorKey, type Rgb } from "./settings";
import { tryCall } from "./util/safe";

const COLOR_DEFAULTS: { [key in ColorKey]: Rgb } = {
    buff: [0.2, 0.55, 1],
    weapon: [1, 0.12, 0.08],
};

/** Fallback art if the spell-alert glow template is missing; built-in client art only. */
const GLOW_FALLBACK = "Interface\\Cooldown\\star4";
const GLOW_SCALE = 1.45;
const GLOW_ALPHA = 0.95;

export function colorDefault(key: ColorKey): Rgb {
    return COLOR_DEFAULTS[key];
}

export function color(key: ColorKey): Rgb {
    const saved = settings.colors[key];
    if (saved !== undefined && type(saved) === "table" && tonumber(saved[0]) !== undefined) {
        return [saved[0], saved[1] ?? 0, saved[2] ?? 0];
    }
    return COLOR_DEFAULTS[key];
}

interface Overlay {
    frame: Frame;
    alert?: SpellAlertFrame;
    texture?: Texture;
}

/** Overlays per button and reminder kind. Kept here, never written onto Blizzard's buttons. */
const overlays = new LuaMap<ActionButton, LuaMap<string, Overlay>>();

function createOverlay(button: ActionButton): Overlay {
    const level = button.GetFrameLevel() + 6;
    // Blizzard's own spell-alert glow, but our own instance, never the one the action bar manager
    // drives, so real procs are unaffected
    const [ok, created] = tryCall(() => CreateFrame("Frame", undefined, button, "ActionButtonSpellAlertTemplate"));
    const alert = ok ? (created as SpellAlertFrame) : undefined;
    if (alert?.ProcStartAnim && alert.ProcLoop) {
        alert.SetFrameStrata("MEDIUM");
        alert.SetFrameLevel(level);
        alert.SetPoint("CENTER", button, "CENTER", 0, 0);
        alert.SetScript("OnShow", () => {
            alert.ProcLoop!.Stop();
            alert.ProcStartAnim!.Play();
        });
        alert.SetScript("OnHide", () => {
            alert.ProcStartAnim!.Stop();
            alert.ProcLoop!.Stop();
        });
        alert.ProcAltGlow?.Hide();
        alert.Hide();
        return { frame: alert, alert };
    }
    const frame = CreateFrame("Frame", undefined, button);
    frame.SetFrameStrata("MEDIUM");
    frame.SetFrameLevel(level);
    frame.SetPoint("CENTER", button, "CENTER", 0, 0);
    const texture = frame.CreateTexture(undefined, "OVERLAY");
    texture.SetAllPoints(frame);
    texture.SetTexture(GLOW_FALLBACK);
    texture.SetBlendMode("ADD");
    frame.Hide();
    return { frame, texture };
}

function overlay(button: ActionButton, kind: string, [r, g, b]: Rgb): Frame {
    let byKind = overlays.get(button);
    if (!byKind) {
        byKind = new LuaMap();
        overlays.set(button, byKind);
    }
    let entry = byKind.get(kind);
    if (!entry) {
        entry = createOverlay(button);
        byKind.set(kind, entry);
    }
    const width = button.GetWidth();
    const height = button.GetHeight();
    entry.frame.SetSize((width < 8 ? 36 : width) * GLOW_SCALE, (height < 8 ? 36 : height) * GLOW_SCALE);
    if (entry.alert) {
        // Desaturated, so the reminder color tints the glow instead of mixing with gold
        for (const texture of [entry.alert.ProcStartFlipbook, entry.alert.ProcLoopFlipbook]) {
            texture?.SetDesaturated(true);
            texture?.SetVertexColor(r, g, b);
        }
        entry.frame.SetAlpha(GLOW_ALPHA);
    } else {
        entry.texture!.SetVertexColor(r, g, b, GLOW_ALPHA);
    }
    return entry.frame;
}

export interface ReminderGlow {
    /** Glows the buttons of this spell; undefined clears. */
    show: (this: void, spellId: number | undefined) => void;
    clear: (this: void) => void;
}

/** One reminder glow (the buff or the weapon buff). `enabled` reads its settings switch. */
function reminderGlow(kind: ColorKey, enabled: (this: void) => boolean): ReminderGlow {
    const glowing = new LuaSet<ActionButton>();
    let last: number | undefined;
    const clearGlow = () => {
        for (const button of glowing) {
            overlays.get(button)?.get(kind)?.frame.Hide();
            glowing.delete(button);
        }
        last = undefined;
    };
    return {
        clear: clearGlow,
        show: (spellId) => {
            if (spellId === undefined || !enabled()) return clearGlow();
            if (spellId === last && !glowing.isEmpty()) return;
            const buttons = buttonsFor(spellId);
            clearGlow();
            last = spellId;
            const rgb = color(kind);
            for (const button of buttons) {
                overlay(button, kind, rgb).Show();
                glowing.add(button);
            }
        },
    };
}

export const buffGlow = reminderGlow("buff", () => settings.showBuff);
export const weaponGlow = reminderGlow("weapon", () => settings.showWeapon);
