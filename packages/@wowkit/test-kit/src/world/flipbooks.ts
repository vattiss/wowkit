// The flipbook of a fake spell-alert glow: its sheet, and the picture it is on once played.
import type { FakeFrame } from "./frames";

/** The flipbooks of the fake game: while stalled (a loading screen), a playing one has not reached a picture yet. */
export const fakeFlipbooks = { isStalled: false };

/**
 * The whole sheet of a flipbook until its animation runs, then one picture of it. Coordinates set by hand stay, as in the
 * game, through a new atlas too, unless it is set with `resetTexCoords`.
 */
export function addFlipbookCoords(alert: FakeFrame): void {
    let isPlayed = false;
    let coordsByHand: number[] | undefined;
    const loop = alert.ProcLoop as FakeFrame & { Play(): void };
    const flipbook = alert.ProcLoopFlipbook as FakeFrame & {
        SetAtlas(atlas: string, useAtlasSize?: boolean, filterMode?: string, resetTexCoords?: boolean): void;
        GetTexCoord(): LuaMultiReturn<number[]>;
        SetTexCoord(...coords: number[]): void;
    };
    loop.Play = () => {
        isPlayed = true;
    };
    flipbook.SetAtlas = (_atlas, _useAtlasSize, _filterMode, resetTexCoords) => {
        isPlayed = false;
        if (resetTexCoords === true) coordsByHand = undefined;
    };
    flipbook.SetTexCoord = (...coords) => {
        coordsByHand = coords;
    };
    flipbook.GetTexCoord = () => {
        if (coordsByHand !== undefined) return $multi(...coordsByHand);
        const size = isPlayed && !fakeFlipbooks.isStalled ? 0.1 : 1;
        return $multi(0, 0, 0, size, size, 0, size, size);
    };
}
