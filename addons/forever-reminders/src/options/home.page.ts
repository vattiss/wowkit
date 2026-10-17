// The landing page: what the addon does, and where to report problems.

import type { LocaleService } from "../locale/locale.service";
import type { WidgetsService } from "./widgets.service";

const GITHUB_URL = "https://github.com/vattiss/forever-reminders";
const ISSUES_URL = `${GITHUB_URL}/issues`;

export class HomePage {
    constructor(
        private readonly locale: LocaleService,
        private readonly widgets: WidgetsService,
    ) {}

    /** Adds the addon's category with the landing page; the other pages go under it. */
    registerHomePage(): SettingsCategory {
        const home = CreateFrame("Frame");
        this.buildHomePage(home);
        const root = Settings.RegisterCanvasLayoutCategory(home, this.locale.getText("TITLE"));
        Settings.RegisterAddOnCategory(root);
        return root;
    }

    private buildHomePage(home: Frame): void {
        const title = home.CreateFontString(undefined, "OVERLAY", "GameFontNormalHuge");
        title.SetPoint("TOPLEFT", 16, -16);
        title.SetTextColor(1, 0.82, 0.2);
        title.SetText(this.locale.getText("TITLE"));
        const text = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlight");
        text.SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -16);
        text.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        text.SetJustifyH("LEFT");
        text.SetWordWrap(true);
        text.SetText(this.locale.getText("OPT_HOME_TEXT"));
        const help = home.CreateFontString(undefined, "OVERLAY", "GameFontHighlightSmall");
        help.SetPoint("TOPLEFT", text, "BOTTOMLEFT", 0, -12);
        help.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        help.SetJustifyH("LEFT");
        help.SetWordWrap(true);
        help.SetText(this.locale.getText("OPT_HOME_HELP"));
        const githubRow = this.widgets.createLinkRow(home, "INFO_GITHUB", GITHUB_URL);
        githubRow.SetPoint("TOPLEFT", help, "BOTTOMLEFT", 0, -16);
        githubRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
        const issuesRow = this.widgets.createLinkRow(home, "INFO_ISSUES", ISSUES_URL);
        issuesRow.SetPoint("TOPLEFT", githubRow, "BOTTOMLEFT", 0, -4);
        issuesRow.SetPoint("RIGHT", home, "RIGHT", -24, 0);
    }
}
