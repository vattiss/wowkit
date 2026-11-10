// The slash command: /gb and /gb table open the table of looks, /gb settings the settings window.
import { OnGameEvent, type OnFirstLogin } from "@wowkit/core";
import type { MessagesService, OptionsService } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import { WINDOW_NAME } from "./style-table.constants";
import type { StyleTableService } from "./style-table.service";

export const COMMAND = "GLOWINGBARS";
/** The table, and the window of a message's look that opens from it. */
const TABLE_WINDOWS = [WINDOW_NAME, "GlowingBarsMessage"];

export class TableCommand implements OnFirstLogin {
    constructor(
        private readonly table: StyleTableService,
        private readonly options: OptionsService,
        private readonly messages: MessagesService,
        private readonly locale: AddonLocale,
    ) {}

    onFirstLogin(): void {
        const globals = _G as unknown as Record<string, unknown>;
        globals[`SLASH_${COMMAND}1`] = "/gb";
        globals[`SLASH_${COMMAND}2`] = "/glowingbars";
        SlashCmdList[COMMAND] = (message) => {
            const word = string.lower(strtrim(message ?? ""));
            if (word === "settings") this.options.open();
            else this.table.toggle();
        };
    }

    /** A fight starts: the table and its message window close, as EllesmereUI's windows do. */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    hideForCombat(): void {
        const globals = _G as unknown as { [name: string]: Frame | undefined };
        const open = TABLE_WINDOWS.map((name) => globals[name]).filter((window) => window?.IsShown() === true);
        if (open.length === 0) return;
        for (const window of open) window!.Hide();
        this.messages.say(this.locale.getText("MSG_CLOSED_FOR_COMBAT"));
    }
}
