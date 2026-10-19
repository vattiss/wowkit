// The slash command that opens the table of looks.
import type { OnFirstLogin } from "@wowkit/core";
import type { StyleTableService } from "./style-table.service";

const COMMAND = "GLOWINGBARSANDAURAS";

export class TableCommand implements OnFirstLogin {
    constructor(private readonly table: StyleTableService) {}

    onFirstLogin(): void {
        const globals = _G as unknown as Record<string, unknown>;
        globals[`SLASH_${COMMAND}1`] = "/gba";
        globals[`SLASH_${COMMAND}2`] = "/glowingbars";
        SlashCmdList[COMMAND] = () => this.table.toggle();
    }
}
