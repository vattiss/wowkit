// The debug report page: a text box and the Report / Clear buttons.
import { getText } from "../../locale";
import { say } from "../../wow/notice";
import { clearDebugData } from "../diagnostics/recorder";
import { buildReport } from "../diagnostics/report";
import { createButton } from "./widgets";

function buildDebugPage(panel: Frame): void {
    const hint = panel.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
    hint.SetPoint("TOPLEFT", 16, -16);
    hint.SetPoint("RIGHT", panel, "RIGHT", -24, 0);
    hint.SetJustifyH("LEFT");
    hint.SetWordWrap(true);
    hint.SetText(getText("OPT_DEBUG_HINT"));

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

    const reportButton = createButton(panel, 160, 22, getText("OPT_DEBUG_REPORT"));
    reportButton.SetPoint("BOTTOMLEFT", 16, 14);
    reportButton.SetScript("OnClick", () => {
        edit.SetText(buildReport());
        edit.HighlightText();
        edit.SetFocus();
    });
    const clearButton = createButton(panel, 160, 22, getText("OPT_DEBUG_CLEAR"));
    clearButton.SetPoint("LEFT", reportButton, "RIGHT", 8, 0);
    clearButton.SetScript("OnClick", () => {
        clearDebugData();
        edit.SetText("");
        say(getText("OPT_DEBUG_CLEARED"));
    });
}

/** The page is built when it is first shown, not at login. */
export function registerDebugPage(root: SettingsCategory): void {
    const panel = CreateFrame("Frame");
    // A new frame starts shown, so the panel's first Show() would not fire OnShow
    panel.Hide();
    let isBuilt = false;
    panel.SetScript("OnShow", (self) => {
        if (isBuilt) return;
        isBuilt = true;
        buildDebugPage(self);
    });
    Settings.RegisterCanvasLayoutSubcategory(root, panel, getText("TAB_DEBUG"));
}
