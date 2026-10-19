// The slash command that opens the table of looks.
import type { OnFirstLogin } from "@wowkit/core";
import type { StyleTableService } from "./style-table.service";

const COMMAND = "GLOWINGBARS";

export class TableCommand implements OnFirstLogin {
    constructor(private readonly table: StyleTableService) {}

    onFirstLogin(): void {
        const globals = _G as unknown as Record<string, unknown>;
        globals[`SLASH_${COMMAND}1`] = "/gb";
        globals[`SLASH_${COMMAND}2`] = "/glowingbars";
        SlashCmdList[COMMAND] = () => this.table.toggle();
    }
}
