// A glow lit by a number the game hides from addon code (a buff's stacks in a fight): addon code may not compare it, but a
// StatusBar takes it. An invisible bar from threshold - 1 to threshold moves the edge of its fill, and a mask on the glow's
// textures rides that edge: at the threshold or above the mask lies over the glow and it shows; below, the mask lies beside
// it and the glow is dark. A mask keeps drawing where clipping to a hidden size would not. The mask is as large as the bar
// or larger: at the bottom it is wholly left of the bar, at the top it covers it.
import { getReadable } from "./secret-value.utils";
import { attempt, tryCall } from "./protected-call.utils";

const WHITE = "Interface\\Buttons\\WHITE8x8";
/** How far the bar reaches past the frame at least: past the alert's start art (150 wide) around the smallest frame. */
const LEAST_PAD = 80;

/** The gate of one glow's frame. */
export interface GlowGate {
    bar: StatusBar;
    mask: MaskTexture;
    threshold: number;
    /** The textures it masks already: a glow may make more as it plays. */
    masked: LuaSet<Texture>;
}

/** The gate of a glow's frame, opening at `threshold`; undefined when the client cannot make one (the glow then stays dark). */
export function createGlowGate(frame: Frame, threshold: number): GlowGate | undefined {
    return attempt(() => {
        // The bar reaches past the frame on every side: the glow's art can be larger than its frame (the alert's start, 150
        // wide whatever the button), and what reaches past the bar would show beside the parked mask
        const size = math.max(getReadable(frame.GetWidth()) ?? 36, getReadable(frame.GetHeight()) ?? 36, 8);
        const pad = math.max(size, LEAST_PAD);
        const bar = CreateFrame("StatusBar", undefined, frame);
        bar.SetPoint("TOPLEFT", frame, "TOPLEFT", -pad, pad);
        bar.SetPoint("BOTTOMRIGHT", frame, "BOTTOMRIGHT", pad, -pad);
        bar.SetStatusBarTexture(WHITE);
        bar.GetStatusBarTexture().SetAlpha(0);
        bar.EnableMouse(false);
        const mask = bar.CreateMaskTexture();
        mask.SetTexture(WHITE, "CLAMPTOBLACKADDITIVE", "CLAMPTOBLACKADDITIVE", "NEAREST");
        // As large as the bar at least, so at the top it covers all of it
        mask.SetSize(size + pad * 2, size + pad * 2);
        mask.SetPoint("RIGHT", bar.GetStatusBarTexture(), "RIGHT", 0, 0);
        const gate: GlowGate = { bar, mask, threshold, masked: new LuaSet() };
        setGateThreshold(gate, threshold);
        return gate;
    });
}

/** The number the gate opens at; it stays shut until it is given a value. */
export function setGateThreshold(gate: GlowGate, threshold: number): void {
    gate.threshold = threshold;
    gate.bar.SetMinMaxValues(threshold - 1, threshold);
    gate.bar.SetValue(threshold - 1);
}

/** The value the gate goes by: a plain number or a secret one, which only the client compares. */
export function setGateValue(gate: GlowGate, value: number): void {
    gate.bar.SetValue(value);
}

/** Puts the mask on every texture of the frame and the frames in it, but the gate's own; true when all took it. */
export function applyGateMask(gate: GlowGate, frame: Frame): boolean {
    let isDone = true;
    for (const texture of listTextures(frame, gate.bar, [])) {
        if (gate.masked.has(texture)) continue;
        const [didSucceed] = tryCall(() => texture.AddMaskTexture(gate.mask));
        if (didSucceed) gate.masked.add(texture);
        else isDone = false;
    }
    return isDone;
}

function listTextures(frame: Frame, skipped: Frame, found: Texture[]): Texture[] {
    for (const region of [...frame.GetRegions()]) {
        if (region !== undefined && getReadable(attempt(() => region.IsObjectType("Texture"))) === true) found.push(region as Texture);
    }
    for (const child of [...frame.GetChildren()]) if (child !== skipped) listTextures(child as Frame, skipped, found);
    return found;
}
