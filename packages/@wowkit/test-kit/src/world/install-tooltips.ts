// The game's tooltip data processor: the calls an addon adds to be made after a spell or item tooltip is filled.
import { defineNamespace } from "./define";

export type TooltipKind = "spell" | "item";

/** What the player sees when the game shows the tooltip of a spell or an item. */
export interface FakeTooltips {
    /** Fills a tooltip of this kind for the ID, runs the addon's calls on it, and gives the lines they added. */
    show(kind: TooltipKind, id: number | undefined): string[];
}

const DATA_TYPES: { [kind in TooltipKind]: number } = { item: 0, spell: 1 };

export function installTooltips(): FakeTooltips {
    const calls: { [dataType: number]: ((tooltip: GameTooltip, data: TooltipData) => void)[] | undefined } = {};

    defineNamespace<typeof TooltipDataProcessor>("TooltipDataProcessor", {
        AddTooltipPostCall: (dataType, call) => {
            const list = calls[dataType as number] ?? [];
            list.push(call);
            calls[dataType as number] = list;
        },
    });

    return {
        show(kind, id) {
            const lines: string[] = [];
            const tooltip = {
                AddLine(text: string) {
                    lines.push(text);
                },
            } as GameTooltip;
            for (const call of calls[DATA_TYPES[kind]] ?? []) call(tooltip, { lines: [], id });
            return lines;
        },
    };
}
