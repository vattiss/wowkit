// The parts of the fake frames a glow's gate uses (see glow-gate.utils): the regions of a frame, the masks on its textures,
// a status bar's range and value; and whether a texture shows through its masks.
import type { FakeFrame } from "./frames";
import { readHiddenNumber } from "./secret-value";

/** Makes a texture (or a mask) in a frame. */
type CreateTexture = (parent: FakeFrame, frameType?: string) => FakeFrame;

/** A texture's own methods: the file it is given, its look, and its masks. */
export function addTextureParts(texture: FakeFrame): FakeFrame {
    const parts = texture as FakeFrame & {
        SetTexture(file: string): void;
        SetDesaturated(isDesaturated: boolean): void;
        SetVertexColor(...color: number[]): void;
    };
    parts.SetTexture = (file) => {
        texture.file = file;
    };
    parts.SetDesaturated = (isDesaturated) => {
        texture.isDesaturated = isDesaturated;
    };
    parts.SetVertexColor = (...color) => {
        texture.vertexColor = color;
    };
    (texture as FakeFrame & { AddMaskTexture(mask: FakeFrame): void }).AddMaskTexture = (mask) => {
        texture.masks = [...(texture.masks ?? []), mask];
    };
    return texture;
}

/** Its textures and texts as the game lists them (GetRegions), what kind each is, and the masks it makes. */
export function addRegions(frame: FakeFrame, createTexture: CreateTexture): void {
    const parts = frame as FakeFrame & {
        GetRegions(): LuaMultiReturn<FakeFrame[]>;
        IsObjectType(kind: string): boolean;
        CreateMaskTexture(): FakeFrame;
    };
    parts.GetRegions = () => {
        const flipbooks = [frame.ProcStartFlipbook, frame.ProcLoopFlipbook, frame.ProcAltGlow].filter((part) => part !== undefined);
        return $multi(...frame.textures, ...flipbooks, ...frame.fontStrings);
    };
    parts.IsObjectType = (kind) => frame.frameType === kind;
    parts.CreateMaskTexture = () => createTexture(frame, "MaskTexture");
}

/** A status bar: its range, its value, and the fill texture whose edge the value moves. */
export function addStatusBar(bar: FakeFrame, createTexture: CreateTexture): void {
    const parts = bar as FakeFrame & {
        SetStatusBarTexture(file: string): void;
        GetStatusBarTexture(): FakeFrame | undefined;
        SetMinMaxValues(min: number, max: number): void;
        SetValue(value: unknown): void;
    };
    parts.SetStatusBarTexture = (file) => {
        bar.fill = createTexture(bar);
        bar.fill.file = file;
    };
    parts.GetStatusBarTexture = () => bar.fill;
    parts.SetMinMaxValues = (min, max) => {
        bar.barMin = min;
        bar.barMax = max;
    };
    parts.SetValue = (value) => {
        bar.barValue = value;
    };
}

/**
 * Does the texture show through its masks? A mask riding a status bar's fill (see glow-gate.utils) covers it at the bar's
 * top only, its value compared as the game would, a secret one too; any other mask lets it show.
 */
export function isShownThroughMasks(texture: FakeFrame): boolean {
    return (texture.masks ?? []).every((mask) => {
        const bar = mask.anchor?.parent;
        if (bar === undefined || bar.fill !== mask.anchor || bar.barMax === undefined) return true;
        const value = readHiddenNumber(bar.barValue);
        return value !== undefined && value >= bar.barMax;
    });
}
