// The size, the columns and the colors of the table of looks.
import type { Rgb } from "@wowkit/wow";

export const WINDOW_NAME = "GlowingBarsLooks";
export const WINDOW_WIDTH = 740;
export const WINDOW_HEIGHT = 520;
export const ROW_HEIGHT = 36;
export const ICON_SIZE = 30;
/** Every second row is tinted bronze, the color of the classic interface. */
export const STRIPE_COLOR: Rgb = [0.85, 0.62, 0.3];
export const STRIPE_ALPHA = 0.14;
export const BRONZE_TEXT: Rgb = [0.78, 0.62, 0.42];
export const HEADER_HEIGHT = 24;
/** Where each column starts, from the left of a row. */
export const COLUMN = { icon: 4, name: 42, kind: 208, color: 304, opacity: 354, message: 432, sound: 514, reset: 656 };
/** The name of an overridden spell, against the gray of one that follows its kind. */
export const OVERRIDDEN_COLOR: [number, number, number] = [1, 0.82, 0];
