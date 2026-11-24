// The Added spells window (issue #76), opened by the button at the top left of the table: the spells added
// on the account's characters (CharacterSpellsSection), with a way back to the table at the top left.
import { OnGameEvent } from "@wowkit/core";
import { type MessagesService, OptionsWindow } from "@wowkit/ui";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import type { CharacterSpellsSection } from "./character-spells.section";
import { BASIC_WINDOW_WIDTH, WINDOW_HEIGHT, WINDOW_NAME } from "./style-table.constants";
import { COMMAND } from "./table-command";

export class AddedSpellsWindowService {
    private window: OptionsWindow | undefined;

    constructor(
        private readonly locale: AddonLocale,
        private readonly messages: MessagesService,
        private readonly spellsSection: CharacterSpellsSection,
    ) {}

    /** Opens the window (built the first time), the list read again; not in a fight. */
    open(): void {
        if (InCombatLockdown()) {
            this.messages.say(this.locale.getText("MSG_NOT_IN_COMBAT"));
            return;
        }
        this.window ??= this.buildWindow();
        this.spellsSection.update();
        this.window.open();
    }

    /** An item's data came in: the list names it, where it was waiting for it. */
    @OnGameEvent("GET_ITEM_INFO_RECEIVED")
    refreshItemNames(itemId: number): void {
        if (this.window?.isShown() === true) this.spellsSection.refreshNames(itemId);
    }

    /** A fight starts: the window closes. */
    @OnGameEvent("PLAYER_REGEN_DISABLED")
    hideForCombat(): void {
        if (this.window?.isShown() === true) this.window.hide();
    }

    private buildWindow(): OptionsWindow {
        const readText = (key: TextKey) => this.locale.getText(key);
        const window = new OptionsWindow(
            "GlowingBarsAddedSpells",
            readText("PROFILES_TITLE"),
            {
                defaults: readText("BTN_DEFAULTS"),
                question: readText("MSG_DEFAULTS_QUESTION"),
                reset: readText("BTN_RESET"),
                cancel: readText("BTN_CANCEL"),
            },
            { width: BASIC_WINDOW_WIDTH, height: WINDOW_HEIGHT },
        );
        window.addTopLeftButton(readText("BTN_OPEN_TABLE"), () => {
            // The command opens or closes the table: one opened meanwhile (/gb) stays open
            const table = (_G as unknown as Record<string, Frame | undefined>)[WINDOW_NAME];
            if (table?.IsShown() !== true) SlashCmdList[COMMAND]?.("", undefined as never);
        });
        this.spellsSection.build(window, window.addTab(readText("TAB_ADDED_SPELLS"), false));
        return window;
    }
}
