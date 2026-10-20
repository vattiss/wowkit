// The size, the columns and the colors of the table of looks.
import type { Rgb } from "@wowkit/wow";

export const WINDOW_NAME = "GlowingBarsLooks";
export const WINDOW_HEIGHT = 520;
export const ROW_HEIGHT = 36;
export const ICON_SIZE = 30;
/** Every second row is tinted bronze, the color of the classic interface. */
export const STRIPE_COLOR: Rgb = [0.85, 0.62, 0.3];
export const STRIPE_ALPHA = 0.14;
export const BRONZE_TEXT: Rgb = [0.78, 0.62, 0.42];
export const HEADER_HEIGHT = 24;
/** A column of the table: where it starts, from the left of a row, and how wide it is. */
export interface Column {
    x: number;
    width: number;
}

/**
 * The columns, side by side. The spell's name and its kind read from the left of their column; every other control is
 * centered in its column, under its header.
 */
export const COLUMN = {
    icon: { x: 4, width: 34 },
    name: { x: 38, width: 146 },
    kind: { x: 184, width: 86 },
    id: { x: 270, width: 70 },
    color: { x: 340, width: 56 },
    opacity: { x: 396, width: 60 },
    message: { x: 456, width: 66 },
    sound: { x: 522, width: 130 },
    actions: { x: 652, width: 72 },
} satisfies { [name: string]: Column };

/** A row is as wide as its columns; the window has a margin inside its border on the left and the scroll bar on the right. */
export const TABLE_WIDTH = COLUMN.actions.x + COLUMN.actions.width;
export const TABLE_LEFT = 28;
export const WINDOW_WIDTH = TABLE_LEFT + TABLE_WIDTH + 34;

/** Where a control of this width starts to sit in the middle of its column. */
export function findCenteredX(column: Column, controlWidth: number): number {
    return column.x + (column.width - controlWidth) / 2;
}
/** The name of an overridden spell, against the gray of one that follows its kind. */
export const OVERRIDDEN_COLOR: [number, number, number] = [1, 0.82, 0];
/** The window border: the silver dialog art, tinted bronze. */
export const BORDER_COLOR: Rgb = [0.85, 0.6, 0.3];
