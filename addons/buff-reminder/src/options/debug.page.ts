// The debug report page: a text box and the Report / Clear buttons.
import type { RecorderService } from "../diagnostics/recorder.service";
import type { ReportService } from "../diagnostics/report.service";

import type { AddonLocale } from "../locale/locale.interface";
import type { MessagesService, OptionsPage, WidgetsService } from "@wowkit/ui";

export class DebugPage implements OptionsPage {
    constructor(
        private readonly locale: AddonLocale,
        private readonly messages: MessagesService,
        private readonly recorder: RecorderService,
        private readonly report: ReportService,
        private readonly widgets: WidgetsService,
    ) {}

    /** The page is built when it is first shown, not at login. */
    registerPage(root: SettingsCategory | undefined): SettingsCategory {
        if (root === undefined) throw new Error("the debug page goes under the home page");
        const panel = CreateFrame("Frame");
        // A new frame starts shown, so the panel's first Show() would not fire OnShow
        panel.Hide();
        let isBuilt = false;
        panel.SetScript("OnShow", (self) => {
            if (isBuilt) return;
            isBuilt = true;
            this.buildDebugPage(self);
        });
        return Settings.RegisterCanvasLayoutSubcategory(root, panel, this.locale.getText("TAB_DEBUG"));
    }

    private buildDebugPage(panel: Frame): void {
        const hint = panel.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        hint.SetPoint("TOPLEFT", 16, -16);
        hint.SetPoint("RIGHT", panel, "RIGHT", -24, 0);
        hint.SetJustifyH("LEFT");
        hint.SetWordWrap(true);
        hint.SetText(this.locale.getText("OPT_DEBUG_HINT"));

        const scroll = CreateFrame("ScrollFrame", undefined, panel, "UIPanelScrollFrameTemplate");
        scroll.SetPoint("TOPLEFT", 16, -70);
        scroll.SetPoint("BOTTOMRIGHT", -36, 48);
        const edit = CreateFrame("EditBox", undefined, scroll);
        edit.SetMultiLine(true);
        edit.SetFontObject("ChatFontSmall");
        edit.SetWidth(580);
        edit.SetHeight(400);
        edit.SetAutoFocus(false);
        edit.EnableMouse(true);
        edit.SetMaxLetters(25000);
        edit.SetTextInsets(4, 4, 4, 4);
        edit.SetScript("OnEscapePressed", (self) => self.ClearFocus());
        scroll.SetScrollChild(edit);

        const reportButton = this.widgets.createButton(panel, 160, 22, this.locale.getText("OPT_DEBUG_REPORT"));
        reportButton.SetPoint("BOTTOMLEFT", 16, 14);
        reportButton.SetScript("OnClick", () => {
            edit.SetText(this.report.buildReport());
            edit.HighlightText();
            edit.SetFocus();
        });
        const clearButton = this.widgets.createButton(panel, 160, 22, this.locale.getText("OPT_DEBUG_CLEAR"));
        clearButton.SetPoint("LEFT", reportButton, "RIGHT", 8, 0);
        clearButton.SetScript("OnClick", () => {
            this.recorder.clearDebugData();
            edit.SetText("");
            this.messages.say(this.locale.getText("OPT_DEBUG_CLEARED"));
        });
    }
}
