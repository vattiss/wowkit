// The classic glow: Blizzard's older gold proc border, the one the Classic clients show. Its soft gold square around the
// button, and when it circles, the marching ants on it. Both in gray, so the reminder's color tints them: a gold color gives
// the look the game shows. Sized as LibButtonGlow-1.0 (and Blizzard before it) draws it on an action button.
// Blizzard's own template for it is gone from the client, and its helper that steps the ants (AnimateTexCoords) is gone
// from newer ones: the ants are stepped here.
import { GLOW_FALLBACK } from "./glow-look.constants";

/** The soft square, in a part of Blizzard's alert art. */
const BORDER_TEXTURE = "Interface\\SpellActivationOverlay\\IconAlert";
const BORDER_COORDS: [left: number, right: number, top: number, bottom: number] = [0.0078125, 0.5078125, 0.27734375, 0.52734375];
/** The ants: a sheet of 256 by 256 pixels, cells of 48, the first 22 of them the frames of the march. */
const ANTS_TEXTURE = "Interface\\SpellActivationOverlay\\IconAlertAnts";
const ANTS_SHEET = 256;
const ANTS_CELL = 48;
const ANTS_FRAMES = 22;
/** Seconds a frame of the march shows: about a third of a second for the whole of it. */
const ANTS_FRAME_SECONDS = 0.017;
/** The frame this much bigger than the button (the art has empty edges); the square fills it. */
export const CLASSIC_SCALE = 1.4;
/** The ants, against the frame. */
export const CLASSIC_ANTS_SCALE = 0.85;

/**
 * The classic glow around `button`, made in `parent`, hidden: the square in `inner` (the frame that breathes or fades), and
 * the ants marching on it when `hasAnts`, sized apart (see `ants`), as they are smaller than the frame.
 */
export function createClassicGlow(
    parent: Frame,
    button: ActionButton,
    level: number,
    hasAnts: boolean,
): { frame: Frame; inner: Frame; ants: Texture | undefined; parts: Texture[] } {
    const frame = CreateFrame("Frame", undefined, parent);
    frame.SetFrameStrata("MEDIUM");
    frame.SetFrameLevel(level);
    frame.SetPoint("CENTER", button, "CENTER", 0, 0);
    const inner = CreateFrame("Frame", undefined, frame);
    inner.SetAllPoints(frame);
    const border = createLayer(inner, BORDER_TEXTURE);
    border.SetTexCoord(...BORDER_COORDS);
    border.SetAllPoints(inner);
    const parts = [border];
    let ants: Texture | undefined;
    if (hasAnts) {
        ants = createLayer(inner, ANTS_TEXTURE);
        ants.SetPoint("CENTER", inner, "CENTER", 0, 0);
        parts.push(ants);
        startAntsMarch(frame, ants);
    }
    frame.Hide();
    return { frame, inner, ants, parts };
}

function createLayer(frame: Frame, file: string): Texture {
    const texture = frame.CreateTexture(undefined, "OVERLAY");
    texture.SetTexture(file);
    texture.SetBlendMode("ADD");
    texture.SetDesaturated(true);
    return texture;
}

/** Steps the ants while the glow shows, by the time that passed, so the march is as fast at any frame rate. */
function startAntsMarch(frame: Frame, ants: Texture): void {
    const columns = math.floor(ANTS_SHEET / ANTS_CELL);
    const cell = ANTS_CELL / ANTS_SHEET;
    let step = 0;
    let carried = 0;
    const draw = () => {
        const left = (step % columns) * cell;
        const top = math.floor(step / columns) * cell;
        ants.SetTexCoord(left, left + cell, top, top + cell);
    };
    draw();
    frame.SetScript("OnUpdate", (_frame, elapsed) => {
        carried += elapsed;
        if (carried < ANTS_FRAME_SECONDS) return;
        const advance = math.floor(carried / ANTS_FRAME_SECONDS);
        carried -= advance * ANTS_FRAME_SECONDS;
        step = (step + advance) % ANTS_FRAMES;
        draw();
    });
}

/** A star of the client's own art, where its alert glow template is missing: hidden, around `button`, made in `parent`. */
export function createFallbackGlow(parent: Frame, button: ActionButton, level: number): { frame: Frame; texture: Texture } {
    const frame = CreateFrame("Frame", undefined, parent);
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
